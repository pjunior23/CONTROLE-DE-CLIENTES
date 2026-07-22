// ============================================================
// CONTROLE DE CARTEIRA — Agência de Tráfego Pago
// Backend único: Express + sessões + JSON local
// Preparado para multi-tenant futuro (campo agencyId em tudo)
// ============================================================
require('dotenv').config();
const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const PDFDocument = require('pdfkit');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');

// Tenant padrão — quando virar SaaS, cada agência terá o seu
const DEFAULT_AGENCY = 'default';

// Funções (papéis operacionais) de cada cliente
const FUNCOES = [
  { key: 'atendimento',  label: 'Estrategista de Atendimento' },
  { key: 'planejamento', label: 'Estrategista de Planejamento' },
  { key: 'copy',         label: 'Copywriter' },
  { key: 'apoio',        label: 'Apoio' },
  { key: 'consultor',    label: 'Consultor/Gerente' },
  { key: 'socialMedia',  label: 'Social Media' },
  { key: 'edicaoVideos', label: 'Edição de Vídeos' },
];

const STATUS_VALIDOS = ['ativo', 'prelancamento', 'saindo'];

// ------------------------------------------------------------
// Persistência simples em JSON
// ------------------------------------------------------------
function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function loadJSON(file, fallback) {
  ensureDataDir();
  const p = path.join(DATA_DIR, file);
  if (!fs.existsSync(p)) return fallback;
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch (e) {
    console.error(`Erro lendo ${file}:`, e.message);
    return fallback;
  }
}

function saveJSON(file, data) {
  ensureDataDir();
  const p = path.join(DATA_DIR, file);
  const tmp = p + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
  fs.renameSync(tmp, p); // gravação atômica: nunca corrompe o arquivo
}

const db = {
  usuarios: () => loadJSON('usuarios.json', []),
  clientes: () => loadJSON('clientes.json', []),
  equipe:   () => loadJSON('equipe.json', []),
  saveUsuarios: (d) => saveJSON('usuarios.json', d),
  saveClientes: (d) => saveJSON('clientes.json', d),
  saveEquipe:   (d) => saveJSON('equipe.json', d),
};

// Primeiro uso: cria o admin inicial se não existir nenhum usuário
function seedAdmin() {
  const usuarios = db.usuarios();
  if (usuarios.length === 0) {
    const login = process.env.ADMIN_LOGIN || 'admin';
    const senha = process.env.ADMIN_SENHA || 'admin123';
    usuarios.push({
      id: crypto.randomUUID(),
      agencyId: DEFAULT_AGENCY,
      login,
      senhaHash: bcrypt.hashSync(senha, 10),
      nome: 'Administrador',
      papel: 'admin',       // 'admin' | 'gestor'
      membroNome: null,     // gestores: nome do membro da equipe correspondente
      criadoEm: new Date().toISOString(),
    });
    db.saveUsuarios(usuarios);
    console.log(`✅ Admin inicial criado (login: ${login}). TROQUE A SENHA em Configurações.`);
  }
}

// ------------------------------------------------------------
// Middlewares
// ------------------------------------------------------------
app.use(express.json());
app.use(session({
  secret: process.env.SESSION_SECRET || 'troque-este-segredo',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 1000 * 60 * 60 * 12 }, // 12h
}));

function requireAuth(req, res, next) {
  if (!req.session.user) return res.status(401).json({ erro: 'Não autenticado' });
  next();
}

function requireAdmin(req, res, next) {
  if (!req.session.user) return res.status(401).json({ erro: 'Não autenticado' });
  if (req.session.user.papel !== 'admin') return res.status(403).json({ erro: 'Apenas administradores' });
  next();
}

// Gestor enxerga apenas clientes onde o membro vinculado aparece em alguma função
function clientesVisiveis(user) {
  const todos = db.clientes().filter(c => c.agencyId === user.agencyId);
  if (user.papel === 'admin') return todos;
  const nome = (user.membroNome || '').trim().toUpperCase();
  if (!nome) return [];
  // Nomes compostos ("Juliana/Paula") contam para cada pessoa
  return todos.filter(c =>
    FUNCOES.some(f => (c.responsaveis?.[f.key] || '').toUpperCase().split('/').map(s => s.trim()).includes(nome))
  );
}

// ------------------------------------------------------------
// Autenticação
// ------------------------------------------------------------
app.post('/api/login', (req, res) => {
  const { login, senha } = req.body || {};
  if (!login || !senha) return res.status(400).json({ erro: 'Informe login e senha' });
  const user = db.usuarios().find(u => u.login.toLowerCase() === String(login).toLowerCase());
  if (!user || !bcrypt.compareSync(senha, user.senhaHash)) {
    return res.status(401).json({ erro: 'Login ou senha incorretos' });
  }
  req.session.user = {
    id: user.id, login: user.login, nome: user.nome,
    papel: user.papel, funcao: user.funcao || null,
    membroNome: user.membroNome, agencyId: user.agencyId,
  };
  res.json({ ok: true, user: req.session.user });
});

app.post('/api/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

app.get('/api/me', requireAuth, (req, res) => res.json(req.session.user));

// ------------------------------------------------------------
// Clientes
// ------------------------------------------------------------
app.get('/api/clientes', requireAuth, (req, res) => {
  res.json(clientesVisiveis(req.session.user));
});

function validarCliente(body) {
  if (!body.nome || !String(body.nome).trim()) return 'Nome é obrigatório';
  if (body.status && !STATUS_VALIDOS.includes(body.status)) return 'Status inválido';
  return null;
}

function montarCliente(body, existente) {
  const resp = {};
  FUNCOES.forEach(f => { resp[f.key] = String(body.responsaveis?.[f.key] ?? existente?.responsaveis?.[f.key] ?? '').trim(); });
  const cli = {
    id: existente?.id || crypto.randomUUID(),
    agencyId: existente?.agencyId || DEFAULT_AGENCY,
    nome: String(body.nome ?? existente?.nome ?? '').trim(),
    marca: String(body.marca ?? existente?.marca ?? '').trim(),
    status: body.status ?? existente?.status ?? 'ativo',
    responsaveis: resp,
    acessoTrafego: body.acessoTrafego ?? existente?.acessoTrafego ?? false,
    dataInauguracao: body.dataInauguracao ?? existente?.dataInauguracao ?? null, // "AAAA-MM-DD"
    dataSaida: body.dataSaida ?? existente?.dataSaida ?? null,
    aniversario: body.aniversario ?? existente?.aniversario ?? null,   // aniversário da unidade
    dataEntrada: body.dataEntrada ?? existente?.dataEntrada ?? null,   // entrada na carteira
    obs: String(body.obs ?? existente?.obs ?? '').trim(),
    criadoEm: existente?.criadoEm || new Date().toISOString(),
    atualizadoEm: new Date().toISOString(),
  };
  // Aniversário da unidade herda dia/mês da inauguração quando não informado
  if (!cli.aniversario && cli.dataInauguracao) {
    const [, m, d] = cli.dataInauguracao.split('-');
    cli.aniversario = `2000-${m}-${d}`;
  }
  return cli;
}

app.post('/api/clientes', requireAdmin, (req, res) => {
  const erro = validarCliente(req.body);
  if (erro) return res.status(400).json({ erro });
  const clientes = db.clientes();
  if (clientes.some(c => c.nome.toLowerCase() === req.body.nome.trim().toLowerCase() && c.agencyId === req.session.user.agencyId)) {
    return res.status(400).json({ erro: 'Já existe um cliente com esse nome' });
  }
  const novo = montarCliente(req.body, null);
  clientes.push(novo);
  db.saveClientes(clientes);
  res.status(201).json(novo);
});

app.put('/api/clientes/:id', requireAdmin, (req, res) => {
  const clientes = db.clientes();
  const idx = clientes.findIndex(c => c.id === req.params.id);
  if (idx === -1) return res.status(404).json({ erro: 'Cliente não encontrado' });
  const erro = validarCliente({ ...clientes[idx], ...req.body });
  if (erro) return res.status(400).json({ erro });
  clientes[idx] = montarCliente(req.body, clientes[idx]);
  db.saveClientes(clientes);
  res.json(clientes[idx]);
});

app.delete('/api/clientes/:id', requireAdmin, (req, res) => {
  const clientes = db.clientes();
  const idx = clientes.findIndex(c => c.id === req.params.id);
  if (idx === -1) return res.status(404).json({ erro: 'Cliente não encontrado' });
  const [removido] = clientes.splice(idx, 1);
  db.saveClientes(clientes);
  res.json({ ok: true, removido: removido.nome });
});

// ------------------------------------------------------------
// Alertas (calculados na hora, sobre os clientes visíveis)
// ------------------------------------------------------------
app.get('/api/alertas', requireAuth, (req, res) => {
  const dias = parseInt(process.env.ALERTA_DIAS_INAUGURACAO || '15', 10);
  const diasAniv = parseInt(process.env.ALERTA_DIAS_ANIVERSARIO || '30', 10);
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  const limite = new Date(hoje); limite.setDate(limite.getDate() + dias);
  const clientes = clientesVisiveis(req.session.user);
  const alertas = { inauguracoes: [], aniversarios: [], saidas: [], pendencias: [] };

  for (const c of clientes) {
    // Cliente que já saiu (data de saída no passado) não gera alertas
    if (c.dataSaida && new Date(c.dataSaida + 'T00:00:00') < hoje) continue;
    if (c.dataInauguracao) {
      const d = new Date(c.dataInauguracao + 'T00:00:00');
      if (d >= hoje && d <= limite) {
        alertas.inauguracoes.push({ cliente: c.nome, data: c.dataInauguracao, id: c.id });
      }
    }
    if (c.aniversario && c.status !== 'saindo' && statusEfetivoSrv(c) !== 'prelancamento') {
      // Aniversário só conta pra quem já inaugurou de fato (senão é a mesma data da inauguração futura)
      // Aniversário se repete todo ano: calcula a próxima ocorrência (mês/dia)
      const [, m, d] = c.aniversario.split('-').map(Number);
      let prox = new Date(hoje.getFullYear(), m - 1, d);
      if (prox < hoje) prox = new Date(hoje.getFullYear() + 1, m - 1, d);
      const diff = Math.round((prox - hoje) / 86400000);
      if (diff <= diasAniv) {
        const iso = `${prox.getFullYear()}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        alertas.aniversarios.push({ cliente: c.nome, data: iso, emDias: diff, id: c.id });
      }
    }
    if (c.status === 'saindo') {
      alertas.saidas.push({ cliente: c.nome, data: c.dataSaida || null, id: c.id });
    }
    const faltando = FUNCOES.filter(f => !(c.responsaveis?.[f.key] || '').trim()).map(f => f.label);
    // Acesso de Tráfego desativado por enquanto (para reativar, descomente):
    // if (!c.acessoTrafego) faltando.push('Acesso de Tráfego');
    if (faltando.length && c.status !== 'saindo') {
      alertas.pendencias.push({ cliente: c.nome, faltando, id: c.id });
    }
  }
  alertas.inauguracoes.sort((a, b) => a.data.localeCompare(b.data));
  alertas.aniversarios.sort((a, b) => a.emDias - b.emDias);
  res.json(alertas);
});

// Status efetivo calculado pelas datas (mesma regra do frontend)
function statusEfetivoSrv(c) {
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  if (c.dataSaida && new Date(c.dataSaida + 'T00:00:00') < hoje) return 'saiu';
  if (c.dataSaida) return 'saindo'; // data de saída futura → Saindo automático
  if (c.status === 'saindo') return 'saindo';
  if (c.dataInauguracao && new Date(c.dataInauguracao + 'T00:00:00') > hoje) return 'prelancamento';
  if (c.status === 'prelancamento') return 'ativo';
  return c.status;
}

// ------------------------------------------------------------
// Visão por pessoa
// ------------------------------------------------------------
function montarPessoas(clientes) {
  const mapa = {};
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  for (const c of clientes) {
    if (c.dataSaida && new Date(c.dataSaida + 'T00:00:00') < hoje) continue; // já saiu
    for (const f of FUNCOES) {
      if (f.key === 'consultor') continue; // Consultor/Gerente não entra na Visão por Pessoa
      const bruto = (c.responsaveis?.[f.key] || '').trim();
      if (!bruto) continue;
      const up = bruto.toUpperCase();
      if (up === 'EQUIPE PRÓPRIA' || up === 'EQUIPE PROPRIA' || up === 'NÃO TEM' || up === 'NAO TEM') continue;
      // "Juliana/Paula" conta para Juliana E para Paula
      for (const parte of bruto.split('/').map(s => s.trim()).filter(Boolean)) {
        const chave = parte.toUpperCase();
        if (!mapa[chave]) mapa[chave] = { nome: parte, clientes: {} };
        if (!mapa[chave].clientes[c.id]) mapa[chave].clientes[c.id] = { id: c.id, cliente: c.nome, status: statusEfetivoSrv(c), funcoes: [] };
        if (!mapa[chave].clientes[c.id].funcoes.includes(f.label)) mapa[chave].clientes[c.id].funcoes.push(f.label);
      }
    }
  }
  return Object.values(mapa)
    .map(p => ({ nome: p.nome, clientes: Object.values(p.clientes), total: Object.keys(p.clientes).length }))
    .sort((a, b) => b.total - a.total);
}

app.get('/api/pessoas', requireAuth, (req, res) => {
  res.json(montarPessoas(clientesVisiveis(req.session.user)));
});

// ------------------------------------------------------------
// Equipe (lista de membros para os dropdowns) — admin gerencia
// ------------------------------------------------------------
app.get('/api/equipe', requireAuth, (req, res) => {
  res.json(db.equipe().filter(m => m.agencyId === req.session.user.agencyId));
});

app.post('/api/equipe', requireAdmin, (req, res) => {
  const nome = String(req.body?.nome || '').trim();
  if (!nome) return res.status(400).json({ erro: 'Nome é obrigatório' });
  const funcao = FUNCOES.some(f => f.key === req.body?.funcao) ? req.body.funcao : null;
  const equipe = db.equipe();
  if (equipe.some(m => m.nome.toUpperCase() === nome.toUpperCase())) {
    return res.status(400).json({ erro: 'Membro já cadastrado' });
  }
  const novo = { id: crypto.randomUUID(), agencyId: DEFAULT_AGENCY, nome, funcao };
  equipe.push(novo);
  db.saveEquipe(equipe);
  res.status(201).json(novo);
});

app.put('/api/equipe/:id', requireAdmin, (req, res) => {
  const equipe = db.equipe();
  const m = equipe.find(x => x.id === req.params.id);
  if (!m) return res.status(404).json({ erro: 'Membro não encontrado' });
  if (req.body?.nome) m.nome = String(req.body.nome).trim();
  if (req.body?.funcao !== undefined) {
    m.funcao = FUNCOES.some(f => f.key === req.body.funcao) ? req.body.funcao : null;
  }
  db.saveEquipe(equipe);
  res.json(m);
});

app.delete('/api/equipe/:id', requireAdmin, (req, res) => {
  const equipe = db.equipe();
  const idx = equipe.findIndex(m => m.id === req.params.id);
  if (idx === -1) return res.status(404).json({ erro: 'Membro não encontrado' });
  equipe.splice(idx, 1);
  db.saveEquipe(equipe);
  res.json({ ok: true });
});

// ------------------------------------------------------------
// Usuários (contas de login) — admin gerencia
// ------------------------------------------------------------
app.get('/api/usuarios', requireAdmin, (req, res) => {
  res.json(db.usuarios().map(({ senhaHash, ...u }) => u));
});

app.post('/api/usuarios', requireAdmin, (req, res) => {
  const { login, senha, nome, papel, funcao, membroNome } = req.body || {};
  if (!login || !senha || !nome) return res.status(400).json({ erro: 'Informe login, senha e nome' });
  if (senha.length < 6) return res.status(400).json({ erro: 'Senha precisa de ao menos 6 caracteres' });
  if (!['admin', 'gestor'].includes(papel)) return res.status(400).json({ erro: 'Papel inválido' });
  const usuarios = db.usuarios();
  if (usuarios.some(u => u.login.toLowerCase() === login.toLowerCase())) {
    return res.status(400).json({ erro: 'Login já em uso' });
  }
  const novo = {
    id: crypto.randomUUID(), agencyId: DEFAULT_AGENCY,
    login: String(login).trim(), senhaHash: bcrypt.hashSync(senha, 10),
    nome: String(nome).trim(), papel,
    funcao: papel === 'gestor' && FUNCOES.some(f => f.key === funcao) ? funcao : null,
    membroNome: papel === 'gestor' ? String(membroNome || '').trim() || null : null,
    criadoEm: new Date().toISOString(),
  };
  usuarios.push(novo);
  db.saveUsuarios(usuarios);
  const { senhaHash, ...semSenha } = novo;
  res.status(201).json(semSenha);
});

app.put('/api/usuarios/:id', requireAdmin, (req, res) => {
  const usuarios = db.usuarios();
  const u = usuarios.find(x => x.id === req.params.id);
  if (!u) return res.status(404).json({ erro: 'Usuário não encontrado' });
  const { senha, nome, papel, funcao, membroNome } = req.body || {};
  if (senha) {
    if (senha.length < 6) return res.status(400).json({ erro: 'Senha precisa de ao menos 6 caracteres' });
    u.senhaHash = bcrypt.hashSync(senha, 10);
  }
  if (nome) u.nome = String(nome).trim();
  if (papel && ['admin', 'gestor'].includes(papel)) u.papel = papel;
  if (funcao !== undefined) u.funcao = u.papel === 'gestor' && FUNCOES.some(f => f.key === funcao) ? funcao : null;
  if (membroNome !== undefined) u.membroNome = u.papel === 'gestor' ? String(membroNome || '').trim() || null : null;
  db.saveUsuarios(usuarios);
  const { senhaHash, ...semSenha } = u;
  res.json(semSenha);
});

app.delete('/api/usuarios/:id', requireAdmin, (req, res) => {
  if (req.params.id === req.session.user.id) return res.status(400).json({ erro: 'Você não pode excluir a si mesmo' });
  const usuarios = db.usuarios();
  const idx = usuarios.findIndex(u => u.id === req.params.id);
  if (idx === -1) return res.status(404).json({ erro: 'Usuário não encontrado' });
  usuarios.splice(idx, 1);
  db.saveUsuarios(usuarios);
  res.json({ ok: true });
});

// ------------------------------------------------------------
// Metadados para o frontend
// ------------------------------------------------------------
app.get('/api/meta', requireAuth, (req, res) => {
  res.json({ funcoes: FUNCOES, status: STATUS_VALIDOS });
});

// ------------------------------------------------------------
// Faturamento — só Admin e Estrategista de Atendimento acessam
// ------------------------------------------------------------
db.faturamento = () => loadJSON('faturamento.json', []);
db.saveFaturamento = (d) => saveJSON('faturamento.json', d);

function podeAcessarFaturamento(user) {
  return user.papel === 'admin' || user.funcao === 'atendimento';
}

function requireFaturamento(req, res, next) {
  if (!req.session.user) return res.status(401).json({ erro: 'Não autenticado' });
  if (!podeAcessarFaturamento(req.session.user)) return res.status(403).json({ erro: 'Sem acesso ao faturamento' });
  next();
}

// Clientes visíveis para faturamento: admin vê todos; atendimento só os próprios (onde é o responsável de Atendimento)
function clientesFaturamentoVisiveis(user) {
  if (user.papel === 'admin') return db.clientes().filter(c => c.agencyId === user.agencyId);
  const nome = (user.membroNome || '').trim().toUpperCase();
  if (!nome) return [];
  return db.clientes().filter(c =>
    c.agencyId === user.agencyId &&
    (c.responsaveis?.atendimento || '').toUpperCase().split('/').map(s => s.trim()).includes(nome)
  );
}

app.get('/api/faturamento/clientes', requireFaturamento, (req, res) => {
  const clientes = clientesFaturamentoVisiveis(req.session.user)
    .map(c => ({ id: c.id, nome: c.nome, marca: c.marca }))
    .sort((a, b) => a.nome.localeCompare(b.nome));
  res.json(clientes);
});

app.get('/api/faturamento/:clienteId', requireFaturamento, (req, res) => {
  const visiveis = clientesFaturamentoVisiveis(req.session.user);
  if (!visiveis.some(c => c.id === req.params.clienteId)) return res.status(403).json({ erro: 'Sem acesso a esse cliente' });
  const registros = db.faturamento()
    .filter(f => f.clienteId === req.params.clienteId)
    .sort((a, b) => a.mes.localeCompare(b.mes));
  res.json(registros);
});

app.post('/api/faturamento', requireFaturamento, (req, res) => {
  const { clienteId, mes, meta, faturamento, ticketMedio } = req.body || {};
  if (!clienteId || !mes || !/^\d{4}-\d{2}$/.test(mes)) return res.status(400).json({ erro: 'Cliente e mês (AAAA-MM) são obrigatórios' });
  const visiveis = clientesFaturamentoVisiveis(req.session.user);
  if (!visiveis.some(c => c.id === clienteId)) return res.status(403).json({ erro: 'Sem acesso a esse cliente' });
  const registros = db.faturamento();
  const idx = registros.findIndex(f => f.clienteId === clienteId && f.mes === mes);
  const registro = {
    id: idx >= 0 ? registros[idx].id : crypto.randomUUID(),
    agencyId: req.session.user.agencyId,
    clienteId, mes,
    meta: meta === '' || meta == null ? null : Number(meta),
    faturamento: faturamento === '' || faturamento == null ? null : Number(faturamento),
    ticketMedio: ticketMedio === '' || ticketMedio == null ? null : Number(ticketMedio),
    criadoEm: idx >= 0 ? registros[idx].criadoEm : new Date().toISOString(),
    atualizadoEm: new Date().toISOString(),
  };
  if (idx >= 0) registros[idx] = registro; else registros.push(registro);
  db.saveFaturamento(registros);
  res.status(201).json(registro);
});

// ------------------------------------------------------------
// Relatórios em PDF — só Admin
// ------------------------------------------------------------
const PDF_OURO = '#C4973B';
const PDF_ROSA = '#e91e8c';
const PDF_SUAVE = '#6b6b78';
const PDF_VERDE = '#1f9d55';
const PDF_VERMELHO = '#d93636';

function moeda(v) {
  if (v == null) return '—';
  return 'R$ ' + Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtDataBR(iso) {
  if (!iso) return '—';
  const [a, m, d] = iso.split('-');
  return `${d}/${m}/${a}`;
}
function nomeMesBR(mesIso) {
  const meses = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
  const [a, m] = mesIso.split('-');
  return `${meses[Number(m) - 1]} de ${a}`;
}

function cabecalhoPDF(doc, titulo, subtitulo) {
  doc.rect(0, 0, doc.page.width, 90).fill('#0a0a0f');
  doc.fillColor(PDF_OURO).fontSize(20).font('Helvetica-Bold').text('BELEZA BOOST', 50, 28);
  doc.fillColor('#ffffff').fontSize(11).font('Helvetica').text('Controle de Clientes — Relatório', 50, 54);
  doc.fillColor('#000000');
  doc.fontSize(16).font('Helvetica-Bold').text(titulo, 50, 110);
  if (subtitulo) doc.fontSize(10).font('Helvetica').fillColor(PDF_SUAVE).text(subtitulo, 50, 132);
  doc.fillColor('#000000');
  doc.moveTo(50, 152).lineTo(doc.page.width - 50, 152).strokeColor('#dddddd').stroke();
  return 168;
}

function tabelaPDF(doc, y, colunas, linhas, larguras) {
  doc.font('Helvetica-Bold').fontSize(9).fillColor(PDF_SUAVE);
  let x = 50;
  colunas.forEach((c, i) => { doc.text(c, x, y, { width: larguras[i] }); x += larguras[i]; });
  y += 16;
  doc.moveTo(50, y).lineTo(doc.page.width - 50, y).strokeColor('#eeeeee').stroke();
  y += 8;
  doc.font('Helvetica').fontSize(9).fillColor('#000000');
  linhas.forEach(linha => {
    if (y > doc.page.height - 60) { doc.addPage(); y = 50; }
    x = 50;
    linha.forEach((val, i) => { doc.text(String(val), x, y, { width: larguras[i] }); x += larguras[i]; });
    y += 16;
  });
  return y;
}

function cartoesPDF(doc, y, itens) {
  const largura = (doc.page.width - 100 - (itens.length - 1) * 12) / itens.length;
  const altura = 64;
  itens.forEach((item, i) => {
    const x = 50 + i * (largura + 12);
    doc.roundedRect(x, y, largura, altura, 6).fillAndStroke('#f7f5f0', '#e5e0d5');
    const tamanhoFonte = String(item.valor).length > 9 ? 12 : 17;
    doc.fillColor(item.cor || PDF_OURO).font('Helvetica-Bold').fontSize(tamanhoFonte)
      .text(item.valor, x + 10, y + 9, { width: largura - 20 });
    doc.fillColor(PDF_SUAVE).font('Helvetica').fontSize(8.5)
      .text(item.rotulo, x + 10, y + altura - 18, { width: largura - 20 });
  });
  doc.fillColor('#000000');
  return y + altura + 16;
}

app.get('/api/relatorios/carteira.pdf', requireAdmin, (req, res) => {
  const mes = /^\d{4}-\d{2}$/.test(req.query.mes) ? req.query.mes : new Date().toISOString().slice(0, 7);
  const clientes = db.clientes().filter(c => c.agencyId === req.session.user.agencyId);
  const ativos = clientes.filter(c => statusEfetivoSrv(c) !== 'saiu');
  const emInauguracao = ativos.filter(c => statusEfetivoSrv(c) === 'prelancamento');
  const entraram = clientes.filter(c => (c.dataEntrada || '').startsWith(mes));
  const sairam = clientes.filter(c => (c.dataSaida || '').startsWith(mes));
  const registrosFat = db.faturamento().filter(f => f.mes === mes);
  const somaMeta = registrosFat.reduce((s, f) => s + (f.meta || 0), 0);
  const somaFat = registrosFat.reduce((s, f) => s + (f.faturamento || 0), 0);

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="relatorio-carteira-${mes}.pdf"`);
  const doc = new PDFDocument({ size: 'A4', margin: 50 });
  doc.pipe(res);
  let y = cabecalhoPDF(doc, 'Relatório Mensal da Carteira', `${nomeMesBR(mes)} — gerado em ${fmtDataBR(new Date().toISOString().slice(0, 10))}`);

  y = cartoesPDF(doc, y, [
    { valor: String(ativos.length), rotulo: 'Clientes ativos' },
    { valor: String(entraram.length), rotulo: 'Entraram no mês', cor: PDF_VERDE },
    { valor: String(sairam.length), rotulo: 'Saíram no mês', cor: PDF_VERMELHO },
    { valor: String(emInauguracao.length), rotulo: 'Em inauguração' },
  ]);
  y += 12;

  doc.font('Helvetica-Bold').fontSize(13).fillColor('#000').text('Faturamento do mês', 50, y); y += 22;
  y = cartoesPDF(doc, y, [
    { valor: moeda(somaMeta), rotulo: 'Meta total' },
    { valor: moeda(somaFat), rotulo: 'Faturado' },
    { valor: (somaFat - somaMeta >= 0 ? '+' : '') + moeda(somaFat - somaMeta), rotulo: 'Diferença', cor: somaFat - somaMeta >= 0 ? PDF_VERDE : PDF_VERMELHO },
    { valor: somaMeta ? Math.round((somaFat / somaMeta) * 100) + '%' : '—', rotulo: '% da meta atingido' },
  ]);
  y += 14;

  if (entraram.length) {
    doc.font('Helvetica-Bold').fontSize(12).text('Clientes que entraram', 50, y); y += 20;
    y = tabelaPDF(doc, y, ['Cliente', 'Data de entrada'], entraram.map(c => [c.nome, fmtDataBR(c.dataEntrada)]), [340, 150]);
    y += 14;
  }
  if (sairam.length) {
    if (y > doc.page.height - 150) { doc.addPage(); y = 50; }
    doc.font('Helvetica-Bold').fontSize(12).text('Clientes que saíram', 50, y); y += 20;
    y = tabelaPDF(doc, y, ['Cliente', 'Data de saída'], sairam.map(c => [c.nome, fmtDataBR(c.dataSaida)]), [340, 150]);
  }
  if (!entraram.length && !sairam.length) {
    doc.font('Helvetica').fontSize(10).fillColor(PDF_SUAVE).text('Nenhuma entrada ou saída registrada neste mês.', 50, y);
  }

  doc.end();
});

app.get('/api/relatorios/churn.pdf', requireAdmin, (req, res) => {
  const clientes = db.clientes().filter(c => c.agencyId === req.session.user.agencyId);
  const saidos = clientes.filter(c => c.dataSaida);
  const porMes = {};
  saidos.forEach(c => { const mes = c.dataSaida.slice(0, 7); porMes[mes] = (porMes[mes] || 0) + 1; });
  const mesesOrdenados = Object.keys(porMes).sort();

  let somaDias = 0, comDatas = 0;
  saidos.forEach(c => {
    if (c.dataEntrada) {
      const dias = (new Date(c.dataSaida) - new Date(c.dataEntrada)) / 86400000;
      if (dias > 0) { somaDias += dias; comDatas++; }
    }
  });
  const mediaMeses = comDatas ? Math.round(somaDias / comDatas / 30) : null;

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'attachment; filename="relatorio-churn.pdf"');
  const doc = new PDFDocument({ size: 'A4', margin: 50 });
  doc.pipe(res);
  let y = cabecalhoPDF(doc, 'Relatório de Churn', `Clientes que já saíram da carteira — gerado em ${fmtDataBR(new Date().toISOString().slice(0, 10))}`);

  y = cartoesPDF(doc, y, [
    { valor: String(saidos.length), rotulo: 'Total de saídas registradas', cor: PDF_VERMELHO },
    { valor: mediaMeses != null ? mediaMeses + ' meses' : '—', rotulo: 'Permanência média' },
    { valor: String(clientes.filter(c => statusEfetivoSrv(c) !== 'saiu').length), rotulo: 'Ativos hoje', cor: PDF_VERDE },
  ]);
  y += 20;

  if (mesesOrdenados.length) {
    doc.font('Helvetica-Bold').fontSize(12).fillColor('#000').text('Saídas por mês', 50, y); y += 24;
    const maxCount = Math.max(1, ...mesesOrdenados.map(m => porMes[m]));
    mesesOrdenados.forEach(mes => {
      if (y > doc.page.height - 60) { doc.addPage(); y = 50; }
      const qtd = porMes[mes];
      const largura = (qtd / maxCount) * 280;
      doc.font('Helvetica').fontSize(9).fillColor('#000').text(nomeMesBR(mes), 50, y, { width: 110 });
      doc.rect(165, y - 1, Math.max(largura, 2), 12).fill(PDF_ROSA);
      doc.fillColor('#000').text(String(qtd), 165 + largura + 8, y);
      y += 20;
    });
  } else {
    doc.font('Helvetica').fontSize(10).fillColor(PDF_SUAVE).text('Nenhuma saída registrada ainda.', 50, y);
  }

  doc.end();
});

app.get('/api/relatorios/carga-pessoa.pdf', requireAdmin, (req, res) => {
  const clientes = db.clientes().filter(c => c.agencyId === req.session.user.agencyId);
  const pessoas = montarPessoas(clientes);

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'attachment; filename="relatorio-carga-por-pessoa.pdf"');
  const doc = new PDFDocument({ size: 'A4', margin: 50 });
  doc.pipe(res);
  let y = cabecalhoPDF(doc, 'Carga de Trabalho por Pessoa', `${pessoas.length} pessoas com clientes ativos — gerado em ${fmtDataBR(new Date().toISOString().slice(0, 10))}`);

  if (pessoas.length) {
    y = tabelaPDF(doc, y, ['Pessoa', 'Clientes ativos'], pessoas.map(p => [p.nome, String(p.total)]), [400, 100]);
  } else {
    doc.font('Helvetica').fontSize(10).fillColor(PDF_SUAVE).text('Nenhuma pessoa com cliente ativo no momento.', 50, y);
  }

  doc.end();
});

// ------------------------------------------------------------
// Páginas estáticas (proteção: sem sessão → login)
// ------------------------------------------------------------
const PUBLICAS = ['/login.html'];
app.use((req, res, next) => {
  const ehHtml = req.path === '/' || req.path.endsWith('.html');
  if (ehHtml && !PUBLICAS.includes(req.path) && !req.session.user) {
    return res.redirect('/login.html');
  }
  next();
});
app.get('/', (req, res) => res.redirect('/dashboard.html'));
app.use(express.static(path.join(__dirname, 'public')));

seedAdmin();
app.listen(PORT, () => console.log(`🚀 Controle de Clientes rodando na porta ${PORT}`));

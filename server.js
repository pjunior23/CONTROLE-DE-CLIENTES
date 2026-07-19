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

const STATUS_VALIDOS = ['ativo', 'ativo_ok', 'prelancamento', 'saindo'];

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
  return todos.filter(c =>
    FUNCOES.some(f => (c.responsaveis?.[f.key] || '').trim().toUpperCase() === nome)
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
    papel: user.papel, membroNome: user.membroNome, agencyId: user.agencyId,
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
  return {
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
    if (c.dataInauguracao) {
      const d = new Date(c.dataInauguracao + 'T00:00:00');
      if (d >= hoje && d <= limite) {
        alertas.inauguracoes.push({ cliente: c.nome, data: c.dataInauguracao, id: c.id });
      }
    }
    if (c.aniversario && c.status !== 'saindo') {
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
    if (!c.acessoTrafego) faltando.push('Acesso de Tráfego');
    if (faltando.length && c.status !== 'saindo') {
      alertas.pendencias.push({ cliente: c.nome, faltando, id: c.id });
    }
  }
  alertas.inauguracoes.sort((a, b) => a.data.localeCompare(b.data));
  alertas.aniversarios.sort((a, b) => a.emDias - b.emDias);
  res.json(alertas);
});

// ------------------------------------------------------------
// Visão por pessoa
// ------------------------------------------------------------
app.get('/api/pessoas', requireAuth, (req, res) => {
  const clientes = clientesVisiveis(req.session.user);
  const mapa = {};
  for (const c of clientes) {
    for (const f of FUNCOES) {
      const nome = (c.responsaveis?.[f.key] || '').trim();
      if (!nome || nome.toUpperCase() === 'EQUIPE PRÓPRIA') continue;
      const chave = nome.toUpperCase();
      if (!mapa[chave]) mapa[chave] = { nome, clientes: {} };
      if (!mapa[chave].clientes[c.id]) mapa[chave].clientes[c.id] = { id: c.id, cliente: c.nome, status: c.status, funcoes: [] };
      mapa[chave].clientes[c.id].funcoes.push(f.label);
    }
  }
  const pessoas = Object.values(mapa)
    .map(p => ({ nome: p.nome, clientes: Object.values(p.clientes), total: Object.keys(p.clientes).length }))
    .sort((a, b) => b.total - a.total);
  res.json(pessoas);
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
  const equipe = db.equipe();
  if (equipe.some(m => m.nome.toUpperCase() === nome.toUpperCase())) {
    return res.status(400).json({ erro: 'Membro já cadastrado' });
  }
  const novo = { id: crypto.randomUUID(), agencyId: DEFAULT_AGENCY, nome };
  equipe.push(novo);
  db.saveEquipe(equipe);
  res.status(201).json(novo);
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
  const { login, senha, nome, papel, membroNome } = req.body || {};
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
  const { senha, nome, papel, membroNome } = req.body || {};
  if (senha) {
    if (senha.length < 6) return res.status(400).json({ erro: 'Senha precisa de ao menos 6 caracteres' });
    u.senhaHash = bcrypt.hashSync(senha, 10);
  }
  if (nome) u.nome = String(nome).trim();
  if (papel && ['admin', 'gestor'].includes(papel)) u.papel = papel;
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
app.listen(PORT, () => console.log(`🚀 Controle de Carteira rodando na porta ${PORT}`));

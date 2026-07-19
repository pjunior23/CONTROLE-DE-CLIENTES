// ============================================================
// Importa a aba "Clientes Geral" (exportada em CSV) para
// data/clientes.json e data/equipe.json
//
// Uso:  node scripts/import-csv.js caminho/da/planilha.csv
//
// Colunas esperadas:
// Cliente, Unidade, Status, Aniversário, Data de Inauguração,
// Data de Entrada, Data de Saída, Estrategista de Atendimento,
// Estrategista de Planejamento, Copywriter, Apoio,
// Consultor/Gerente, Acesso do Tráfego, Social Media, Edição de Vídeos
//
// Regras:
// - Nome do cliente = "Marca Unidade" (ex.: "Fast Escova Aclimação");
//   marca "Outro" usa só a unidade
// - "A confirmar" vira campo vazio (aparece como pendência no app)
// - Datas dd/mm/aaaa viram aaaa-mm-dd
// ============================================================
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const arquivo = process.argv[2];
if (!arquivo) {
  console.error('Uso: node scripts/import-csv.js caminho/da/planilha.csv');
  process.exit(1);
}

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

// Parser de CSV simples com suporte a aspas
function parseCSV(texto) {
  const linhas = [];
  let linha = [], campo = '', dentroAspas = false;
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (dentroAspas) {
      if (c === '"' && texto[i + 1] === '"') { campo += '"'; i++; }
      else if (c === '"') dentroAspas = false;
      else campo += c;
    } else if (c === '"') dentroAspas = true;
    else if (c === ',') { linha.push(campo); campo = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && texto[i + 1] === '\n') i++;
      linha.push(campo); campo = '';
      if (linha.some(x => x.trim())) linhas.push(linha);
      linha = [];
    } else campo += c;
  }
  if (campo || linha.length) { linha.push(campo); if (linha.some(x => x.trim())) linhas.push(linha); }
  return linhas;
}

const texto = fs.readFileSync(arquivo, 'utf8').replace(/^﻿/, '');
const linhas = parseCSV(texto);

// Localiza o cabeçalho (linha que contém "Cliente" e "Unidade")
let cabIdx = linhas.findIndex(l =>
  l.some(c => c.trim().toLowerCase() === 'cliente') &&
  l.some(c => c.trim().toLowerCase() === 'unidade'));
if (cabIdx === -1) {
  console.error('❌ Não achei o cabeçalho (colunas "Cliente" e "Unidade"). Confira se exportou a aba certa.');
  process.exit(1);
}
const cab = linhas[cabIdx].map(c => c.trim().toLowerCase());
const col = (nome) => cab.findIndex(c => c.includes(nome));

const idx = {
  marca: col('cliente'),
  unidade: col('unidade'),
  status: col('status'),
  aniversario: col('anivers'),
  inauguracao: col('inaugura'),
  entrada: col('entrada'),
  saida: col('saída') !== -1 ? col('saída') : col('saida'),
  atendimento: col('atendimento'),
  planejamento: col('planejamento'),
  copy: col('copywriter'),
  apoio: col('apoio'),
  consultor: col('consultor'),
  acesso: col('acesso'),
  socialMedia: col('social'),
  edicaoVideos: col('vídeo') !== -1 ? col('vídeo') : col('video'),
};

function limpar(v) {
  const s = String(v ?? '').trim();
  return s.toLowerCase() === 'a confirmar' ? '' : s;
}

// dd/mm/aaaa → aaaa-mm-dd
function converterData(v) {
  const m = String(v ?? '').trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (!m) return null;
  let [, d, mes, a] = m;
  if (a.length === 2) a = '20' + a;
  return `${a}-${String(mes).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function converterStatus(v) {
  const s = String(v ?? '').trim().toLowerCase();
  if (s.includes('pré') || s.includes('pre-') || s.includes('lançamento') || s.includes('inaugura')) return 'prelancamento';
  if (s.includes('sai') || s.includes('cancel') || s.includes('encerr')) return 'saindo';
  return 'ativo';
}

const clientes = [];
const nomesEquipe = new Set();
const avisos = [];

for (const l of linhas.slice(cabIdx + 1)) {
  const marcaBruta = String(l[idx.marca] ?? '').trim();
  const unidade = String(l[idx.unidade] ?? '').trim();
  if (!unidade && !marcaBruta) continue;

  const marca = marcaBruta.toLowerCase() === 'outro' ? '' : marcaBruta;
  const nome = [marca, unidade].filter(Boolean).join(' ') || marcaBruta;

  const responsaveis = {
    atendimento: limpar(l[idx.atendimento]),
    planejamento: limpar(l[idx.planejamento]),
    copy: limpar(l[idx.copy]),
    apoio: limpar(l[idx.apoio]),
    consultor: limpar(l[idx.consultor]),
    socialMedia: limpar(l[idx.socialMedia]),
    edicaoVideos: limpar(l[idx.edicaoVideos]),
  };

  Object.values(responsaveis).forEach(n => {
    const up = n.toUpperCase();
    if (n && up !== 'EQUIPE PRÓPRIA' && up !== 'EQUIPE PROPRIA') {
      n.split('/').map(x => x.trim()).filter(Boolean).forEach(x => nomesEquipe.add(x));
    }
  });

  if (clientes.some(c => c.nome.toLowerCase() === nome.toLowerCase())) {
    avisos.push(`⚠️ Nome duplicado ignorado: ${nome}`);
    continue;
  }

  clientes.push({
    id: crypto.randomUUID(),
    agencyId: 'default',
    nome,
    marca,
    status: converterStatus(l[idx.status]),
    responsaveis,
    acessoTrafego: limpar(l[idx.acesso]).toLowerCase() === 'sim',
    dataInauguracao: converterData(l[idx.inauguracao]),
    dataSaida: converterData(l[idx.saida]),
    aniversario: converterData(l[idx.aniversario]),
    dataEntrada: converterData(l[idx.entrada]),
    obs: '',
    criadoEm: new Date().toISOString(),
    atualizadoEm: new Date().toISOString(),
  });
}

const equipe = [...nomesEquipe].sort((a, b) => a.localeCompare(b))
  .map(nome => ({ id: crypto.randomUUID(), agencyId: 'default', nome }));

fs.writeFileSync(path.join(DATA_DIR, 'clientes.json'), JSON.stringify(clientes, null, 2));
fs.writeFileSync(path.join(DATA_DIR, 'equipe.json'), JSON.stringify(equipe, null, 2));

avisos.forEach(a => console.log(a));
console.log(`✅ Importados ${clientes.length} clientes e ${equipe.length} membros da equipe.`);
const marcas = [...new Set(clientes.map(c => c.marca).filter(Boolean))];
console.log(`   Marcas: ${marcas.join(', ')}`);

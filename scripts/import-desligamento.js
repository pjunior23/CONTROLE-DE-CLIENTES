// Importa a lista de clientes desligados: cria quem ainda não existe no cadastro
// e preenche a Data de Saída de quem já existe (o que joga o cliente pro Histórico
// automaticamente, já que o status é calculado pela data).
// Uso: npm run import-desligamento
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const clientesPath = path.join(DATA_DIR, 'clientes.json');

if (!fs.existsSync(clientesPath)) {
  console.error('❌ Não encontrei data/clientes.json — rode este script na pasta do projeto, com os clientes já importados.');
  process.exit(1);
}
const clientes = JSON.parse(fs.readFileSync(clientesPath, 'utf8'));

// Lista bruta (nome do CSV, dd/mm/aaaa). Duas exceções não são Fast Escova (avisadas pelo usuário):
// "DRA NAIARA" → marca própria "Dra. Naiara" | "MICHELE SPA" → marca própria "Michele Spa"
const LISTA = [
  ['ERECHIM', '10/05/2025'], ['VALPARAÍSO', '12/05/2025'], ['NOVA FRIBURGO', '13/05/2025'],
  ['RIO DO SUL', '01/06/2025'], ['PICOS', '01/07/2025'], ['ONDINA', '30/06/2025'],
  ['VILAS DO ATLANTICO', '10/08/2025'], ['SANTA BARBÁRA', '20/08/2025'], ['ARNIQUEIRA', '01/09/2025'],
  ['MÉIER', '08/09/2025'], ['LEM', '30/09/2025'], ['SAGUAÇU', '30/09/2025'],
  ['SETOR AEROPORTO', '20/10/2025'], ['SJ CAMPOS', '05/10/2025'], ['PIRENÓPOLIS', '13/10/2025'],
  ['SEMINÁRIO', '13/10/2025'], ['VILA ANASTACIO', '21/10/2025'], ['SÃO LUIS SHOPPING', '31/10/2025'],
  ['MOOCA JUVENTUS', '19/11/2025'], ['BARRA FUNDA', '01/11/2025'], ['PIRACICABA', '12/12/2025'],
  ['PALHOÇA', '12/12/2025'], ['FLORIP CAPOEIRAS', '12/12/2025'], ['AMERICANA SP', '15/12/2025'],
  ['SÃO VICENTE', '10/01/2026'], ['SANTO AMARO', '20/01/2026'],
  ['MICHELE SPA', '20/01/2026'], ['VILA SANTA CATARINA', '25/01/2026'], ['MUSEU DO IPIRANGA', '05/02/2026'],
  ['FORTALEZA ALDEOTA', '01/02/2026'], ['GURUPI', '09/02/2026'], ['DRA NAIARA', '20/02/2026'],
  ['CAMBUCI', '20/02/2026'], ['RIO BRANCO', '25/02/2026'], ['JUIZ DE FORA', '01/03/2026'],
  ['PARNAIBA', '10/03/2026'], ['SANTA HELENA', '10/03/2026'], ['BARRETOS', '10/03/2026'],
  ['VILA GUILHERME', '15/03/2026'], ['BENTO GONÇALVES', '15/03/2026'], ['PALMARES', '25/03/2026'],
  ['SÃO CARLOS', '20/03/2026'], ['CURVELO', '01/03/2026'], ['JARDIM OLÍMPICO', '27/03/2026'],
  ['PIRASSUNUNGA', '14/04/2026'], ['NOVA MUTUM', '15/04/2026'], ['ARACAJU', '01/04/2026'],
  ['JARDIM BOTÂNICO', '10/04/2026'], ['VILA MATILDE', '10/05/2026'], ['PONTA PORÃ', '01/05/2026'],
  ['BENTIVI SHOPPING', '05/05/2026'], ['MANHATTAN', '05/05/2026'], ['SERTÃOZINHO', '05/05/2026'],
  ['GRANJA VIANA', '29/06/2026'], ['CAMPO GRANDE', '01/07/2026'], ['PATOS DE MINAS', '05/07/2026'],
  ['ASA SUL', '05/07/2026'], ['MOGI DAS CRUZES', '05/07/2026'], ['OSASCO', '10/07/2026'],
  ['POÇOS DE CALDAS', '10/07/2026'], ['BUTANTÃ', '16/07/2026'],
];

function limpar(s) {
  return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().trim();
}
function tituloCase(s) {
  const minusculas = ['de', 'da', 'do', 'das', 'dos', 'e'];
  return s.toLowerCase().split(' ').map((p, i) => minusculas.includes(p) && i > 0 ? p : p.charAt(0).toUpperCase() + p.slice(1)).join(' ');
}
function converterData(dd_mm_aaaa) {
  const [d, m, a] = dd_mm_aaaa.split('/');
  return `${a}-${m}-${d}`;
}

function montarNomeMarca(nomeCru) {
  const alvo = limpar(nomeCru);
  if (alvo === 'DRA NAIARA') return { nome: 'Dra. Naiara', marca: 'Dra. Naiara' };
  if (alvo === 'MICHELE SPA') return { nome: 'Michele Spa', marca: 'Michele Spa' };
  const unidade = tituloCase(nomeCru);
  return { nome: `Fast Escova ${unidade}`, marca: 'Fast Escova' };
}

let atualizados = 0, criados = 0;
const detalhesAtualizados = [];
const detalhesCriados = [];

for (const [nomeCru, dataStr] of LISTA) {
  const dataSaida = converterData(dataStr);
  const alvo = limpar(nomeCru);
  // Procura cliente já existente cujo nome contenha essa unidade
  let achado = clientes.find(c => limpar(c.nome).includes(alvo) || alvo.includes(limpar(c.nome)));

  if (achado) {
    achado.dataSaida = dataSaida;
    achado.atualizadoEm = new Date().toISOString();
    atualizados++;
    detalhesAtualizados.push(`${achado.nome} → saída em ${dataStr}`);
  } else {
    const { nome, marca } = montarNomeMarca(nomeCru);
    const respVazio = {};
    ['atendimento', 'planejamento', 'copy', 'apoio', 'consultor', 'socialMedia', 'edicaoVideos'].forEach(k => respVazio[k] = '');
    const novo = {
      id: crypto.randomUUID(),
      agencyId: 'default',
      nome,
      marca,
      status: 'ativo',
      responsaveis: respVazio,
      acessoTrafego: false,
      dataInauguracao: null,
      dataSaida,
      aniversario: null,
      dataEntrada: null,
      obs: 'Importado da lista de desligamento',
      criadoEm: new Date().toISOString(),
      atualizadoEm: new Date().toISOString(),
    };
    clientes.push(novo);
    criados++;
    detalhesCriados.push(`${nome} → criado, saída em ${dataStr}`);
  }
}

fs.writeFileSync(clientesPath, JSON.stringify(clientes, null, 2));

console.log(`✅ ${atualizados} clientes já existentes atualizados com data de saída.`);
console.log(`✅ ${criados} clientes novos criados (já com data de saída, vão direto pro Histórico).`);
console.log('\n--- Atualizados ---');
detalhesAtualizados.forEach(l => console.log('  ' + l));
console.log('\n--- Criados ---');
detalhesCriados.forEach(l => console.log('  ' + l));

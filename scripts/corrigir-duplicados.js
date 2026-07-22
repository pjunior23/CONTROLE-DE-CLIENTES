// Encontra clientes com o mesmo nome (duplicados, geralmente por o script de
// importação ter rodado mais de uma vez) e mescla eles num só registro:
// - mantém o cliente "mais completo" (com mais campos preenchidos)
// - se algum duplicado tinha data de saída e o mantido não, copia pra ele
// - migra os lançamentos de faturamento dos duplicados pro cliente mantido
// - remove os duplicados
// Uso: npm run corrigir-duplicados
const fs = require('fs');
const path = require('path');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const clientesPath = path.join(DATA_DIR, 'clientes.json');
const faturamentoPath = path.join(DATA_DIR, 'faturamento.json');

if (!fs.existsSync(clientesPath)) {
  console.error('❌ Não encontrei data/clientes.json — rode este script na pasta do projeto.');
  process.exit(1);
}
const clientes = JSON.parse(fs.readFileSync(clientesPath, 'utf8'));
const faturamento = fs.existsSync(faturamentoPath) ? JSON.parse(fs.readFileSync(faturamentoPath, 'utf8')) : [];

function limpar(s) {
  return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().trim();
}

// Pontua o quanto um cliente está "preenchido" — usado pra decidir qual manter
function pontuar(c) {
  let pts = 0;
  if (c.dataEntrada) pts += 2;
  if (c.dataInauguracao) pts += 1;
  if (c.aniversario) pts += 1;
  if (c.obs && c.obs !== 'Importado da lista de desligamento') pts += 2;
  if (c.acessoTrafego) pts += 1;
  const resp = c.responsaveis || {};
  pts += Object.values(resp).filter(v => (v || '').trim()).length;
  if (faturamento.some(f => f.clienteId === c.id)) pts += 5;
  return pts;
}

// Agrupa por nome normalizado
const grupos = {};
for (const c of clientes) {
  const chave = limpar(c.nome);
  if (!grupos[chave]) grupos[chave] = [];
  grupos[chave].push(c);
}

const idsRemover = new Set();
const relatorio = [];

for (const chave in grupos) {
  const grupo = grupos[chave];
  if (grupo.length < 2) continue;

  // Escolhe o "mantido": maior pontuação; empate → criado há mais tempo (mais antigo)
  const ordenado = [...grupo].sort((a, b) => {
    const diff = pontuar(b) - pontuar(a);
    if (diff !== 0) return diff;
    return (a.criadoEm || '').localeCompare(b.criadoEm || '');
  });
  const mantido = ordenado[0];
  const duplicados = ordenado.slice(1);

  relatorio.push(`\n"${mantido.nome}" — ${grupo.length} registros encontrados. Mantendo id ${mantido.id} (criado ${mantido.criadoEm || '—'})`);

  for (const dup of duplicados) {
    // Se o duplicado tem data de saída e o mantido não, copia
    if (dup.dataSaida && !mantido.dataSaida) {
      mantido.dataSaida = dup.dataSaida;
      relatorio.push(`  → copiada data de saída (${dup.dataSaida}) do registro removido ${dup.id}`);
    }
    // Migra lançamentos de faturamento do duplicado pro mantido (sem sobrescrever mês já existente)
    const registrosDup = faturamento.filter(f => f.clienteId === dup.id);
    for (const r of registrosDup) {
      const jaTem = faturamento.some(f => f.clienteId === mantido.id && f.mes === r.mes);
      if (jaTem) {
        relatorio.push(`  → faturamento de ${r.mes} do registro removido ${dup.id} IGNORADO (mantido já tinha esse mês)`);
      } else {
        r.clienteId = mantido.id;
        relatorio.push(`  → faturamento de ${r.mes} migrado do registro removido ${dup.id}`);
      }
    }
    idsRemover.add(dup.id);
    relatorio.push(`  → removido registro duplicado ${dup.id} (criado ${dup.criadoEm || '—'})`);
  }
}

if (idsRemover.size === 0) {
  console.log('✅ Nenhum cliente duplicado encontrado. Nada foi alterado.');
  process.exit(0);
}

const clientesFinal = clientes.filter(c => !idsRemover.has(c.id));
fs.writeFileSync(clientesPath, JSON.stringify(clientesFinal, null, 2));
fs.writeFileSync(faturamentoPath, JSON.stringify(faturamento, null, 2));

console.log(`✅ ${idsRemover.size} registro(s) duplicado(s) removido(s), em ${Object.values(grupos).filter(g => g.length > 1).length} grupo(s) de nomes repetidos.`);
console.log(relatorio.join('\n'));

// Importa os dados reais de faturamento (planilha FATURAMENTO_2026) para data/faturamento.json,
// casando cada "unidade" da planilha com o cliente correspondente pelo nome.
// Uso: npm run import-faturamento
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const clientesPath = path.join(DATA_DIR, 'clientes.json');
const faturamentoPath = path.join(DATA_DIR, 'faturamento.json');
const planilha = JSON.parse(fs.readFileSync(path.join(__dirname, 'faturamento-2026.json'), 'utf8'));

if (!fs.existsSync(clientesPath)) {
  console.error('❌ Não encontrei data/clientes.json — rode este script na pasta do projeto, com os clientes já importados.');
  process.exit(1);
}
const clientes = JSON.parse(fs.readFileSync(clientesPath, 'utf8'));

function limpar(s) {
  return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().trim();
}

function encontrarCliente(unidade) {
  const alvo = limpar(unidade);
  // 1) match exato do nome do cliente terminando com a unidade
  let achado = clientes.find(c => limpar(c.nome).endsWith(alvo) || limpar(c.nome) === alvo);
  if (achado) return achado;
  // 2) nome do cliente contém a unidade como palavra
  achado = clientes.find(c => limpar(c.nome).includes(alvo));
  return achado || null;
}

const faturamentoExistente = fs.existsSync(faturamentoPath) ? JSON.parse(fs.readFileSync(faturamentoPath, 'utf8')) : [];
const porChave = new Map(faturamentoExistente.map(f => [`${f.clienteId}|${f.mes}`, f]));

let importados = 0;
const naoEncontrados = [];

for (const item of planilha) {
  const cliente = encontrarCliente(item.unidade);
  if (!cliente) { naoEncontrados.push(item.unidade); continue; }
  for (const [mes, dados] of Object.entries(item.meses)) {
    const chave = `${cliente.id}|${mes}`;
    const existente = porChave.get(chave);
    const registro = {
      id: existente?.id || crypto.randomUUID(),
      agencyId: cliente.agencyId || 'default',
      clienteId: cliente.id,
      mes,
      meta: dados.meta,
      faturamento: dados.faturamento,
      ticketMedio: dados.ticketMedio,
      criadoEm: existente?.criadoEm || new Date().toISOString(),
      atualizadoEm: new Date().toISOString(),
    };
    porChave.set(chave, registro);
    importados++;
  }
}

fs.writeFileSync(faturamentoPath, JSON.stringify([...porChave.values()], null, 2));

console.log(`✅ ${importados} registros de faturamento importados/atualizados.`);
if (naoEncontrados.length) {
  console.log(`\n⚠️  ${naoEncontrados.length} unidades da planilha não encontraram cliente correspondente (verifique o nome no cadastro):`);
  naoEncontrados.forEach(u => console.log(`   - ${u}`));
}

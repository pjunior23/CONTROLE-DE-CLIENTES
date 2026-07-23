// Lança o faturamento histórico (jul/2025 a jul/2026) das duas unidades de Araguaína
// (Jardim Filadélfia e José de Brito), passado pelo Juninho a partir da planilha
// financeira. Só tem o "Total Recebido" — meta e ticket médio ficam em branco por
// enquanto, dá pra completar depois direto na tela de Faturamento.
// Uso: npm run import-faturamento-araguaina
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

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

const MESES = ['2025-07', '2025-08', '2025-09', '2025-10', '2025-11', '2025-12',
  '2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06', '2026-07'];

const DADOS = [
  {
    alvo: 'JARDIM FILADELFIA',
    valores: [146617.80, 128375.40, 140841.80, 179002.80, 189354.04, 228943.68,
      150321.60, 140714.10, 179359.20, 164933.80, 198204.90, 179853.90, 116646.70],
  },
  {
    alvo: 'JOSE DE BRITO',
    valores: [209433.30, 201296.00, 188719.50, 224501.99, 207882.75, 247645.84,
      145686.10, 146744.40, 177001.85, 174473.20, 191247.00, 197446.82, 124999.65],
  },
];

let totalLancado = 0;

for (const { alvo, valores } of DADOS) {
  const cliente = clientes.find(c => limpar(c.nome).includes(alvo));
  if (!cliente) {
    console.log(`⚠️  Não encontrei cliente com nome contendo "${alvo}" — pulei.`);
    continue;
  }
  console.log(`\n"${cliente.nome}" (id ${cliente.id}):`);
  valores.forEach((valor, i) => {
    const mes = MESES[i];
    const idx = faturamento.findIndex(f => f.clienteId === cliente.id && f.mes === mes);
    const registro = {
      id: idx >= 0 ? faturamento[idx].id : crypto.randomUUID(),
      agencyId: cliente.agencyId || 'default',
      clienteId: cliente.id,
      mes,
      meta: idx >= 0 ? faturamento[idx].meta : null,
      faturamento: valor,
      ticketMedio: idx >= 0 ? faturamento[idx].ticketMedio : null,
      criadoEm: idx >= 0 ? faturamento[idx].criadoEm : new Date().toISOString(),
      atualizadoEm: new Date().toISOString(),
    };
    if (idx >= 0) faturamento[idx] = registro; else faturamento.push(registro);
    console.log(`  ${mes}: R$ ${valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
    totalLancado++;
  });
}

fs.writeFileSync(faturamentoPath, JSON.stringify(faturamento, null, 2));
console.log(`\n✅ ${totalLancado} lançamento(s) de faturamento gravado(s).`);

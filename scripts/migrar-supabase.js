// Migra os dados que hoje estão em data/*.json para o banco Postgres (Supabase).
// Rode UMA VEZ, depois de configurar DATABASE_URL no .env, com os JSONs de
// produção baixados em data/ (usuarios.json, clientes.json, equipe.json,
// faturamento.json). Não apaga nem altera os arquivos JSON — só lê e copia.
// Uso: npm run migrar-supabase
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { db, ensureSchema, pool } = require('../db');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');

function lerJSON(nome) {
  const p = path.join(DATA_DIR, nome);
  if (!fs.existsSync(p)) {
    console.log(`⚠️  ${nome} não encontrado em ${DATA_DIR} — pulando (fica vazio no banco).`);
    return [];
  }
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL não está configurada no .env. Copie a connection string do Supabase antes de rodar.');
    process.exit(1);
  }

  console.log('🔧 Preparando o banco (criando tabelas se ainda não existirem)...');
  await ensureSchema();

  const usuarios = lerJSON('usuarios.json');
  const clientes = lerJSON('clientes.json');
  const equipe = lerJSON('equipe.json');
  const faturamento = lerJSON('faturamento.json');

  console.log(`📦 Encontrado: ${usuarios.length} usuário(s), ${clientes.length} cliente(s), ${equipe.length} membro(s) de equipe, ${faturamento.length} lançamento(s) de faturamento.`);

  if (usuarios.length) {
    console.log('➡️  Enviando usuários...');
    await db.saveUsuarios(usuarios);
  }
  if (equipe.length) {
    console.log('➡️  Enviando equipe...');
    await db.saveEquipe(equipe);
  }
  if (clientes.length) {
    console.log('➡️  Enviando clientes...');
    await db.saveClientes(clientes);
  }
  if (faturamento.length) {
    console.log('➡️  Enviando faturamento...');
    await db.saveFaturamento(faturamento);
  }

  console.log('\n✅ Migração concluída! Conferindo o que ficou salvo no banco:');
  console.log(`   usuarios: ${(await db.usuarios()).length}`);
  console.log(`   clientes: ${(await db.clientes()).length}`);
  console.log(`   equipe: ${(await db.equipe()).length}`);
  console.log(`   faturamento: ${(await db.faturamento()).length}`);

  await pool.end();
}

main().catch((e) => {
  console.error('❌ Erro na migração:', e);
  process.exit(1);
});

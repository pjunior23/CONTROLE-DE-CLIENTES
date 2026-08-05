// ============================================================
// Camada de dados — Postgres (Supabase)
// Antes os dados viviam em arquivos JSON num Volume do Railway (sem backup
// automático). Agora vivem num banco Postgres de verdade, com backup automático
// do próprio Supabase.
//
// Pra não precisar reescrever toda a lógica de negócio do server.js (que
// trabalha com "array inteiro na memória, mexe, salva de novo"), a interface
// db.usuarios()/db.clientes()/... continua igual — só que agora busca do banco
// — e db.saveX(arrayInteiro) sincroniza a tabela inteira com o array (insere/
// atualiza quem está no array, apaga quem não está mais), tudo dentro de uma
// transação (ou aplica tudo, ou não aplica nada).
// ============================================================
const { Pool, types } = require('pg');

// date -> mantém como string "AAAA-MM-DD" pura, sem o driver converter pra
// objeto Date (isso reintroduziria o mesmo tipo de bug de fuso horário que já
// corrigimos — ver hojeBR() no server.js).
types.setTypeParser(1082, (val) => val);
// numeric -> number (o driver por padrão devolve como string, pra não perder
// precisão; aqui não precisamos disso, então convertemos pra número direto).
types.setTypeParser(1700, (val) => (val === null ? null : Number(val)));

if (!process.env.DATABASE_URL) {
  console.warn('⚠️  DATABASE_URL não configurada — defina a connection string do Supabase.');
}

// SSL fica ligado por padrão (o Supabase exige). Só desliga se DATABASE_URL_SSL=disable
// for setado explicitamente — usado nos testes locais contra um Postgres de mentira.
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL && process.env.DATABASE_URL_SSL !== 'disable'
    ? { rejectUnauthorized: false }
    : undefined,
});

async function ensureSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS usuarios (
      id uuid PRIMARY KEY,
      "agencyId" text NOT NULL DEFAULT 'default',
      login text NOT NULL UNIQUE,
      "senhaHash" text NOT NULL,
      nome text NOT NULL,
      papel text NOT NULL,
      funcao text,
      "membroNome" text,
      "criadoEm" timestamptz NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS equipe (
      id uuid PRIMARY KEY,
      "agencyId" text NOT NULL DEFAULT 'default',
      nome text NOT NULL,
      funcao text
    );
    CREATE TABLE IF NOT EXISTS clientes (
      id uuid PRIMARY KEY,
      "agencyId" text NOT NULL DEFAULT 'default',
      nome text NOT NULL,
      marca text DEFAULT '',
      status text NOT NULL DEFAULT 'ativo',
      responsaveis jsonb NOT NULL DEFAULT '{}',
      "acessoTrafego" boolean NOT NULL DEFAULT false,
      "dataInauguracao" date,
      "dataSaida" date,
      aniversario date,
      "dataEntrada" date,
      "artesSemanais" integer,
      obs text DEFAULT '',
      "criadoEm" timestamptz NOT NULL DEFAULT now(),
      "atualizadoEm" timestamptz NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS faturamento (
      id uuid PRIMARY KEY,
      "agencyId" text NOT NULL DEFAULT 'default',
      "clienteId" uuid NOT NULL,
      mes text NOT NULL,
      meta numeric,
      faturamento numeric,
      "ticketMedio" numeric,
      "criadoEm" timestamptz NOT NULL DEFAULT now(),
      "atualizadoEm" timestamptz NOT NULL DEFAULT now(),
      UNIQUE ("clienteId", mes)
    );
  `);
}

// Sincroniza uma tabela inteira com um array em memória: insere ou atualiza
// (upsert) cada item do array, e apaga do banco quem não está mais no array.
// Replica o antigo "sobrescrever o arquivo JSON inteiro", só que atômico.
async function sincronizarTabela(client, tabela, colunas, linhas) {
  const nomesColunas = colunas.map((c) => `"${c}"`).join(', ');
  const placeholders = colunas.map((_, i) => `$${i + 1}`).join(', ');
  const updates = colunas.filter((c) => c !== 'id').map((c) => `"${c}" = EXCLUDED."${c}"`).join(', ');

  for (const linha of linhas) {
    const valores = colunas.map((c) => (linha[c] === undefined ? null : linha[c]));
    await client.query(
      `INSERT INTO ${tabela} (${nomesColunas}) VALUES (${placeholders})
       ON CONFLICT (id) DO UPDATE SET ${updates}`,
      valores
    );
  }

  const ids = linhas.map((l) => l.id);
  if (ids.length) {
    const marcadores = ids.map((_, i) => `$${i + 1}`).join(', ');
    await client.query(`DELETE FROM ${tabela} WHERE id NOT IN (${marcadores})`, ids);
  } else {
    await client.query(`DELETE FROM ${tabela}`);
  }
}

async function salvarComTransacao(tabela, colunas, linhas) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await sincronizarTabela(client, tabela, colunas, linhas);
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

const COLUNAS_USUARIOS = ['id', 'agencyId', 'login', 'senhaHash', 'nome', 'papel', 'funcao', 'membroNome', 'criadoEm'];
const COLUNAS_EQUIPE = ['id', 'agencyId', 'nome', 'funcao'];
const COLUNAS_CLIENTES = ['id', 'agencyId', 'nome', 'marca', 'status', 'responsaveis', 'acessoTrafego',
  'dataInauguracao', 'dataSaida', 'aniversario', 'dataEntrada', 'artesSemanais', 'obs', 'criadoEm', 'atualizadoEm'];
const COLUNAS_FATURAMENTO = ['id', 'agencyId', 'clienteId', 'mes', 'meta', 'faturamento', 'ticketMedio', 'criadoEm', 'atualizadoEm'];

const db = {
  usuarios: async () => (await pool.query('SELECT * FROM usuarios')).rows,
  clientes: async () => (await pool.query('SELECT * FROM clientes')).rows,
  equipe: async () => (await pool.query('SELECT * FROM equipe')).rows,
  faturamento: async () => (await pool.query('SELECT * FROM faturamento')).rows,

  saveUsuarios: (lista) => salvarComTransacao('usuarios', COLUNAS_USUARIOS, lista),
  saveEquipe: (lista) => salvarComTransacao('equipe', COLUNAS_EQUIPE, lista),
  saveClientes: (lista) => salvarComTransacao(
    'clientes',
    COLUNAS_CLIENTES,
    lista.map((c) => ({ ...c, responsaveis: JSON.stringify(c.responsaveis || {}) }))
  ),
  saveFaturamento: (lista) => salvarComTransacao('faturamento', COLUNAS_FATURAMENTO, lista),
};

module.exports = { pool, db, ensureSchema };

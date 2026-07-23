// Atualiza Social Media / Edição de Vídeos / Artes semanais de um lote de clientes,
// a partir da lista que o estrategista de atendimento passou pro Juninho.
// Regras de segurança (pra não estragar nada já cadastrado certo):
// - Campo "tem o serviço" (SM/Edição): só mexe se estiver vazio hoje. Se já tiver um
//   nome real ou "EQUIPE PRÓPRIA" lá, deixa como está. Se já tiver "NÃO TEM" (contradiz
//   a lista), REMOVE o "NÃO TEM" (fica vazio, vira pendência normal pra alguém definir
//   quem faz) em vez de inventar um nome.
// - Campo "não tem o serviço": só marca "NÃO TEM" se estiver vazio hoje. Se já tiver
//   nome real ou "EQUIPE PRÓPRIA" (contradiz a lista), NÃO mexe — só avisa no relatório
//   pra revisão manual.
// - Artes semanais: aplica direto o número (4 pra quem tem, null pra quem não tem),
//   sobrescrevendo o que já tiver — combinado explicitamente com o Juninho.
// Uso: npm run atualizar-servicos
const fs = require('fs');
const path = require('path');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const clientesPath = path.join(DATA_DIR, 'clientes.json');

if (!fs.existsSync(clientesPath)) {
  console.error('❌ Não encontrei data/clientes.json — rode este script na pasta do projeto.');
  process.exit(1);
}
const clientes = JSON.parse(fs.readFileSync(clientesPath, 'utf8'));

function limpar(s) {
  return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().trim();
}

// sm/video: true = tem (agência faz) | false = "NÃO TEM" | null = não mexe nesse campo
// artes: número (aplica direto) | null = marca como não tem (limpa o campo)
const LOTE = [
  // Com social media, edição de vídeos e artes
  ...['Vinhedo', 'Tailândia', 'Suzano', 'São Judas', 'Santa Maria', 'Sacomã', 'Recreio',
    'Porto Nacional', 'Paraiso', 'Icaraí', 'Cidade Nova', 'Alphaville Campinas']
    .map(nome => ({ nome, sm: true, video: true, artes: 4 })),
  // Com social media e artes (sem edição de vídeo)
  ...['Sobradinho', 'Planaltina', 'Santarém']
    .map(nome => ({ nome, sm: true, video: false, artes: 4 })),
  // Apenas artes (sem social media, sem edição de vídeo)
  ...['Trindade', 'Quirinópolis']
    .map(nome => ({ nome, sm: false, video: false, artes: 4 })),
  // Sem nenhum dos três
  ...['Vila Velha', 'Vitória', 'Novo Hamburgo', 'Lajeado', 'Goiania 2', 'Bacacheri', 'Açailândia']
    .map(nome => ({ nome, sm: false, video: false, artes: null })),

  // --- Carteira Fabio ---
  // Com Social Media (fazemos artes e vídeos)
  ...['Barão Geraldo', 'Damha São José do Rio Preto', 'Jabaquara', 'Morumbi', 'Palmas',
    'Paulo Afonso', 'São José do Rio Preto', 'Saúde', 'Studio DNA', 'Taquaral', 'Varginha',
    'Vila Leopoldina', 'Vila Mariana', 'Vila Mascote', 'Verbo Divino']
    .map(nome => ({ nome, sm: true, video: true, artes: 4 })),
  // Sem Social Media (não fazemos artes nem vídeos)
  // "Alto de Pinheiro" ficou de fora de propósito: já tem Social Media (Rafael) e
  // artes semanais cadastrados como bônus — o Juninho confirmou que é exceção, não mexer.
  ...['Alfenas', 'Bosque da Saúde', 'Gama', 'Guará', 'Shopping Light', 'Taguatinga',
    'Vergueiro - Alto do Ipiranga', 'Vila Formosa']
    .map(nome => ({ nome, sm: false, video: false, artes: null })),
];

const relatorio = { aplicados: [], conflitos: [], ambiguos: [], naoEncontrados: [] };

function ajustarCampo(cliente, chave, deveTer, rotulo) {
  const atual = (cliente.responsaveis?.[chave] || '').trim();
  const atualUp = atual.toUpperCase();
  const ehNome = atual && atualUp !== 'NÃO TEM' && atualUp !== 'NAO TEM' && atualUp !== 'EQUIPE PRÓPRIA' && atualUp !== 'EQUIPE PROPRIA';
  const ehPropria = atualUp === 'EQUIPE PRÓPRIA' || atualUp === 'EQUIPE PROPRIA';

  if (deveTer) {
    // Lista diz que TEM o serviço
    if (ehNome || ehPropria) return null; // já reflete "tem" de algum jeito — não mexe
    if (atualUp === 'NÃO TEM' || atualUp === 'NAO TEM') {
      cliente.responsaveis[chave] = ''; // contradição: limpa pra virar pendência normal
      return `${rotulo}: tinha "NÃO TEM" mas a lista diz que tem — limpei o campo (falta definir o responsável)`;
    }
    return null; // já estava vazio, continua vazio (pendência normal)
  } else {
    // Lista diz que NÃO TEM o serviço
    if (ehNome || ehPropria) {
      relatorio.conflitos.push(`${cliente.nome} — ${rotulo} está como "${atual}" no cadastro, mas a lista diz que não tem. NÃO mexi, revisar manualmente.`);
      return null;
    }
    if (atualUp !== 'NÃO TEM' && atualUp !== 'NAO TEM') {
      cliente.responsaveis[chave] = 'NÃO TEM';
      return `${rotulo}: marcado como NÃO TEM`;
    }
    return null; // já estava NÃO TEM
  }
}

for (const item of LOTE) {
  const alvo = limpar(item.nome);
  const candidatos = clientes.filter(c => limpar(c.nome).includes(alvo));

  if (candidatos.length === 0) { relatorio.naoEncontrados.push(item.nome); continue; }
  if (candidatos.length > 1) {
    relatorio.ambiguos.push(`"${item.nome}" bateu com ${candidatos.length} clientes: ${candidatos.map(c => c.nome).join(', ')}`);
    continue;
  }

  const cliente = candidatos[0];
  const mudancas = [];
  const m1 = ajustarCampo(cliente, 'socialMedia', item.sm, 'Social Media');
  if (m1) mudancas.push(m1);
  const m2 = ajustarCampo(cliente, 'edicaoVideos', item.video, 'Edição de Vídeos');
  if (m2) mudancas.push(m2);

  const artesAntes = cliente.artesSemanais ?? null;
  const artesDepois = item.artes;
  if (artesAntes !== artesDepois) {
    cliente.artesSemanais = artesDepois;
    mudancas.push(`Artes semanais: ${artesAntes ?? '—'} → ${artesDepois ?? '—'}`);
  }

  cliente.atualizadoEm = new Date().toISOString();
  if (mudancas.length) relatorio.aplicados.push(`${cliente.nome}:\n  - ${mudancas.join('\n  - ')}`);
}

fs.writeFileSync(clientesPath, JSON.stringify(clientes, null, 2));

console.log(`\n✅ ${relatorio.aplicados.length} cliente(s) atualizado(s):\n`);
relatorio.aplicados.forEach(l => console.log(l + '\n'));

if (relatorio.conflitos.length) {
  console.log(`\n⚠️  ${relatorio.conflitos.length} conflito(s) — não mexi, revisar manualmente:`);
  relatorio.conflitos.forEach(l => console.log('  ' + l));
}
if (relatorio.ambiguos.length) {
  console.log(`\n⚠️  ${relatorio.ambiguos.length} nome(s) ambíguo(s) — pulei:`);
  relatorio.ambiguos.forEach(l => console.log('  ' + l));
}
if (relatorio.naoEncontrados.length) {
  console.log(`\n⚠️  ${relatorio.naoEncontrados.length} não encontrado(s) no cadastro:`);
  relatorio.naoEncontrados.forEach(l => console.log('  ' + l));
}

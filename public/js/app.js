// ============ Utilidades compartilhadas ============
const FUNCAO_LABEL = {
  atendimento: 'Estrategista de Atendimento',
  planejamento: 'Estrategista de Planejamento',
  copy: 'Copywriter',
  apoio: 'Apoio',
  consultor: 'Consultor/Gerente',
  socialMedia: 'Social Media',
  edicaoVideos: 'Edição de Vídeos',
};

const STATUS_LABEL = {
  ativo: '🟢 Ativo',
  prelancamento: '🟡 Em Inauguração',
  saindo: '🔴 Saindo',
};

// Tema claro/escuro (escolha de cada usuário, salva no navegador)
function aplicarTema() {
  document.documentElement.dataset.theme = localStorage.getItem('tema') || 'dark';
}
function alternarTema() {
  const novo = (localStorage.getItem('tema') || 'dark') === 'dark' ? 'light' : 'dark';
  localStorage.setItem('tema', novo);
  aplicarTema();
}
aplicarTema();

async function api(caminho, opcoes = {}) {
  const r = await fetch(caminho, {
    headers: { 'Content-Type': 'application/json' },
    ...opcoes,
    body: opcoes.body ? JSON.stringify(opcoes.body) : undefined,
  });
  if (r.status === 401) { window.location.href = '/login.html'; throw new Error('Sessão expirada'); }
  const dados = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(dados.erro || 'Erro inesperado');
  return dados;
}

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
}

function fmtData(iso) {
  if (!iso) return '—';
  const [a, m, d] = iso.split('-');
  return `${d}/${m}/${a}`;
}

function hojeISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Cliente que já saiu: data de saída no passado → vai para o histórico
function clienteSaiu(c) {
  return !!(c.dataSaida && c.dataSaida < hojeISO());
}

// Status efetivo, calculado pelas datas:
// saída no passado → Saiu | status Saindo → Saindo
// inauguração no futuro → Em Inauguração (automático) | senão → status salvo
function statusEfetivo(c) {
  if (clienteSaiu(c)) return 'saiu';
  if (c.dataSaida) return 'saindo';           // data de saída marcada (futura) → Saindo automático
  if (c.status === 'saindo') return 'saindo'; // saindo sem data definida
  if (c.dataInauguracao && c.dataInauguracao > hojeISO()) return 'prelancamento';
  if (c.status === 'prelancamento') return 'ativo'; // data já passou: virou ativo sozinho
  return c.status;
}

// Logo da marca (fallback 1: logo pelo nome do cliente; fallback 2: avatar com inicial)
function slugMarca(m) {
  return String(m || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().trim().replace(/[^a-z0-9]+/g, '-');
}
function logoMarcaHtml(c) {
  const ini = esc((c.nome || '?').trim().charAt(0).toUpperCase());
  const sMarca = slugMarca(c.marca);
  const sNome = slugMarca(c.nome);
  const primeiro = sMarca || sNome;
  if (!primeiro) return `<div class="avatar">${ini}</div>`;
  const alt = sMarca && sNome && sMarca !== sNome ? sNome : '';
  return `<img class="logo-marca" src="img/marcas/${primeiro}.png" alt="" data-alt="${alt}"
    onerror="if(this.dataset.alt && !this.dataset.tentou){this.dataset.tentou=1;this.src='img/marcas/'+this.dataset.alt+'.png'}else{this.outerHTML='<div class=&quot;avatar&quot;>${ini}</div>'}">`;
}

// Sidebar comum a todas as páginas internas
async function montarSidebar(paginaAtiva) {
  const user = await api('/api/me');
  window.USUARIO = user;
  const itens = [
    { href: 'dashboard.html', rotulo: '📊 Dashboard' },
    { href: 'clientes.html', rotulo: '👥 Clientes' },
    { href: 'pessoas.html', rotulo: '🧑‍💼 Por Pessoa' },
  ];
  if (user.papel === 'admin' || user.funcao === 'atendimento') itens.push({ href: 'faturamento.html', rotulo: '💰 Faturamento' });
  if (user.papel === 'admin') itens.push({ href: 'configuracoes.html', rotulo: '⚙️ Configurações' });
  document.getElementById('sidebar').innerHTML = `
    <div class="logo"><img src="img/beleza-boost.png" class="logo-bb" alt="Beleza Boost" onerror="this.outerHTML='<div class=&quot;marca&quot;>✨ Beleza Boost</div>'"><div class="app">Controle de Clientes</div></div>
    <nav class="menu">
      ${itens.map(i => `<a href="${i.href}" class="${i.href === paginaAtiva ? 'ativo' : ''}" onclick="fecharMenuMobile()">${i.rotulo}</a>`).join('')}
    </nav>
    <div class="user-card">
      <div class="nome">${esc(user.nome)}</div>
      <div class="papel">${user.papel === 'admin' ? '👑 Administrador' : '👤 ' + esc(FUNCAO_LABEL[user.funcao] || 'Equipe')}</div>
      <div class="acoes">
        <button onclick="alternarTema()" title="Alternar tema claro/escuro">🌓 Tema</button>
        <button onclick="sair()">🚪 Sair</button>
      </div>
    </div>`;
  montarTopoMobile();
  return user;
}

// Barra superior + botão hambúrguer, só aparecem no celular (ver CSS @media)
function montarTopoMobile() {
  if (!document.getElementById('topoMobile')) {
    const topo = document.createElement('div');
    topo.id = 'topoMobile';
    topo.className = 'topo-mobile';
    topo.innerHTML = `
      <button class="hamburguer" onclick="abrirMenuMobile()" aria-label="Abrir menu">☰</button>
      <span class="topo-mobile-titulo">✨ Beleza Boost</span>`;
    document.body.prepend(topo);
  }
  if (!document.getElementById('overlayMenu')) {
    const overlay = document.createElement('div');
    overlay.id = 'overlayMenu';
    overlay.className = 'overlay-menu';
    overlay.onclick = fecharMenuMobile;
    document.body.appendChild(overlay);
  }
}
function abrirMenuMobile() {
  document.getElementById('sidebar').classList.add('aberta');
  document.getElementById('overlayMenu').classList.add('visivel');
}
function fecharMenuMobile() {
  document.getElementById('sidebar').classList.remove('aberta');
  document.getElementById('overlayMenu')?.classList.remove('visivel');
}

async function sair() {
  await api('/api/logout', { method: 'POST' });
  window.location.href = '/login.html';
}

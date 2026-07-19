// ============ Utilidades compartilhadas ============
const STATUS_LABEL = {
  ativo: '🟣 Ativo',
  ativo_ok: '🟢 Ativo OK',
  prelancamento: '🟡 Pré-lançamento',
  saindo: '🔴 Saindo',
};

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

// Sidebar comum a todas as páginas internas
async function montarSidebar(paginaAtiva) {
  const user = await api('/api/me');
  window.USUARIO = user;
  const itens = [
    { href: 'dashboard.html', rotulo: '📊 Dashboard' },
    { href: 'clientes.html', rotulo: '👥 Clientes' },
    { href: 'pessoas.html', rotulo: '🧑‍💼 Por Pessoa' },
  ];
  if (user.papel === 'admin') itens.push({ href: 'configuracoes.html', rotulo: '⚙️ Configurações' });
  document.getElementById('sidebar').innerHTML = `
    <div class="logo">🎯 Controle de Carteira</div>
    <nav class="menu">
      ${itens.map(i => `<a href="${i.href}" class="${i.href === paginaAtiva ? 'ativo' : ''}">${i.rotulo}</a>`).join('')}
    </nav>
    <div class="user-card">
      <div class="nome">${esc(user.nome)}</div>
      <div class="papel">${user.papel === 'admin' ? '👑 Administrador' : '📈 Gestor de Tráfego'}</div>
      <div class="acoes">
        ${user.papel === 'admin' ? '<a href="configuracoes.html">⚙️ Config</a>' : ''}
        <button onclick="sair()">🚪 Sair</button>
      </div>
    </div>`;
  return user;
}

async function sair() {
  await api('/api/logout', { method: 'POST' });
  window.location.href = '/login.html';
}

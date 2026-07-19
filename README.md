# 🎯 Controle de Carteira

App web de controle de clientes da carteira de uma agência de tráfego pago. Substitui a planilha "Clientes e Responsáveis" por um sistema com login, permissões, alertas e visão por pessoa.

## Stack

Node.js + Express em um único `server.js`. Frontend em HTML/CSS/JS puro (sem framework), um HTML por tela em `/public`. Login por usuário e senha (bcryptjs) com sessões em memória (express-session). Dados em arquivos JSON locais na pasta `data/` (Supabase previsto para o futuro). Deploy no Railway via Dockerfile (`node:20-slim`).

## Estrutura de pastas

```
controle-carteira/
├── server.js              # Todo o backend (rotas, auth, persistência)
├── package.json
├── Dockerfile
├── .env.example           # Modelo de variáveis (copie para .env)
├── .gitignore             # .env e data/ NUNCA vão para o Git
├── data/                  # Criada automaticamente (JSON local, fora do Git)
│   ├── usuarios.json      # Contas de login (senhas com hash bcrypt)
│   ├── clientes.json      # Carteira de clientes
│   └── equipe.json        # Membros da equipe (dropdowns)
├── scripts/
│   └── import-csv.js      # Importa a planilha exportada em CSV
├── docs/
│   ├── DEPLOY.md          # Guia de deploy e operação
│   ├── MANUAL.md          # Manual do usuário
│   └── Manual-do-Usuario.docx
└── public/
    ├── login.html         # Tela de login
    ├── dashboard.html     # Métricas + alertas
    ├── clientes.html      # Lista, filtros e CRUD de clientes
    ├── pessoas.html       # Visão por membro da equipe
    ├── configuracoes.html # Equipe + contas de acesso (só admin)
    ├── css/style.css      # Tema escuro compartilhado
    └── js/app.js          # Utilidades compartilhadas (api, sidebar)
```

## Como rodar localmente

```
npm install
copy .env.example .env     (edite os valores)
npm start
```

Acesse http://localhost:3000. No primeiro boot, se não existir nenhum usuário, é criado o admin inicial com `ADMIN_LOGIN`/`ADMIN_SENHA` do `.env` (padrão `admin`/`admin123` — troque imediatamente).

## Variáveis de ambiente

| Variável | Padrão | Descrição |
|---|---|---|
| `PORT` | 3000 | Porta HTTP (o Railway define sozinho) |
| `SESSION_SECRET` | — | Segredo das sessões. Obrigatório em produção |
| `ADMIN_LOGIN` / `ADMIN_SENHA` | admin / admin123 | Admin criado no primeiro boot |
| `ALERTA_DIAS_INAUGURACAO` | 15 | Antecedência do alerta de inauguração |
| `ALERTA_DIAS_ANIVERSARIO` | 30 | Antecedência do alerta de aniversário da unidade |
| `DATA_DIR` | ./data | Pasta dos JSONs (no Railway, aponte para o Volume) |

## Modelo de dados

Todos os registros carregam `agencyId` (hoje sempre `"default"`) — preparação para multi-tenant/SaaS: quando houver mais agências, basta filtrar por `agencyId` (os filtros já existem em todas as consultas).

**Cliente** (`clientes.json`): `id`, `agencyId`, `nome` (marca + unidade, ex.: "Fast Escova Aclimação"), `marca` (para filtro; vazio quando "Outro"), `status` (`ativo` | `ativo_ok` | `prelancamento` | `saindo`), `responsaveis` ({ `atendimento` (Estrategista de Atendimento), `planejamento` (Estrategista de Planejamento), `copy` (Copywriter), `apoio`, `consultor` (Consultor/Gerente), `socialMedia`, `edicaoVideos` } — texto livre; `"EQUIPE PRÓPRIA"` indica que o próprio cliente cuida; vazio = pendência), `acessoTrafego` (bool), `dataInauguracao`, `dataSaida`, `aniversario` (aniversário da unidade, gera alerta anual) e `dataEntrada` (`AAAA-MM-DD` ou null), `obs`, `criadoEm`, `atualizadoEm`.

**Usuário** (`usuarios.json`): `id`, `agencyId`, `login`, `senhaHash` (bcrypt), `nome`, `papel` (`admin` | `gestor`), `membroNome` (gestores: nome do membro da equipe usado para filtrar a visão), `criadoEm`.

**Equipe** (`equipe.json`): `id`, `agencyId`, `nome`.

## API

Todas as rotas retornam JSON; erros vêm como `{ "erro": "mensagem" }`.

| Método | Rota | Acesso | Descrição |
|---|---|---|---|
| POST | `/api/login` | público | Body `{login, senha}` → cria sessão |
| POST | `/api/logout` | logado | Encerra a sessão |
| GET | `/api/me` | logado | Dados do usuário logado |
| GET | `/api/clientes` | logado | Admin: todos. Gestor: só onde `membroNome` aparece |
| POST | `/api/clientes` | admin | Cria cliente |
| PUT | `/api/clientes/:id` | admin | Atualiza cliente |
| DELETE | `/api/clientes/:id` | admin | Exclui cliente |
| GET | `/api/alertas` | logado | `{inauguracoes, aniversarios, saidas, pendencias}` sobre os clientes visíveis |
| GET | `/api/pessoas` | logado | Clientes agrupados por responsável, com funções |
| GET | `/api/equipe` | logado | Lista membros |
| POST / DELETE | `/api/equipe[/:id]` | admin | Adiciona / remove membro |
| GET / POST | `/api/usuarios` | admin | Lista / cria contas (nunca retorna hash) |
| PUT / DELETE | `/api/usuarios/:id` | admin | Edita (inclui reset de senha) / exclui conta |
| GET | `/api/meta` | logado | Funções e status válidos (para o frontend) |

Páginas HTML (exceto `login.html`) redirecionam para o login quando não há sessão.

## Regras de permissão

**Admin**: vê e edita tudo; gerencia equipe e contas. **Gestor**: só enxerga clientes onde o `membroNome` vinculado aparece em alguma função; não edita nada (a API bloqueia com 403 e a interface esconde os botões).

## Importar a planilha atual

Exporte a aba **"Clientes Geral"** como CSV (com a aba aberta: Arquivo → Fazer download → CSV) e rode:

```
node scripts/import-csv.js caminho/da/planilha.csv
```

O script monta o nome como marca + unidade ("Fast Escova Aclimação"; marca "Outro" usa só a unidade), converte datas dd/mm/aaaa, separa nomes compostos ("Juliana/Paula" vira dois membros), transforma **"A confirmar" em campo vazio** (que aparece como pendência no dashboard) e gera `data/clientes.json` + `data/equipe.json`. Revise o resultado após importar.

## Avisos importantes

Sessões ficam em memória: **todo redeploy derruba os logins** — a equipe precisa entrar de novo. Os JSONs em `data/` são os dados de produção: configure um **Volume no Railway** e faça **backup regular** (ver `docs/DEPLOY.md`). Nunca commite `.env` nem `data/`.

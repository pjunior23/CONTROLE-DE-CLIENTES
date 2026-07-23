# ✨ Controle de Clientes — Beleza Boost

App web de controle de clientes da carteira de uma agência de tráfego pago. Substitui a planilha "Clientes e Responsáveis" por um sistema com login, permissões, alertas, visão por pessoa, faturamento por cliente e relatórios em PDF.

## Stack

Node.js + Express em um único `server.js`. Frontend em HTML/CSS/JS puro (sem framework), um HTML por tela em `/public`, responsivo (desktop e mobile). Login por usuário e senha (bcryptjs) com sessões em memória (express-session). Dados em arquivos JSON locais na pasta `data/` (Supabase previsto para o futuro). Gráficos com Chart.js (CDN) e relatórios em PDF com `pdfkit`. Deploy no Railway via Dockerfile (`node:20-slim`).

## Estrutura de pastas

```
controle-carteira/
├── server.js              # Todo o backend (rotas, auth, persistência, PDFs)
├── package.json
├── Dockerfile
├── .env.example           # Modelo de variáveis (copie para .env)
├── .gitignore             # .env e data/ NUNCA vão para o Git
├── data/                  # Criada automaticamente (JSON local, fora do Git)
│   ├── usuarios.json      # Contas de login (senhas com hash bcrypt)
│   ├── clientes.json      # Carteira de clientes
│   ├── equipe.json        # Membros da equipe (dropdowns)
│   └── faturamento.json   # Lançamentos mensais de meta/faturamento por cliente
├── scripts/
│   ├── import-csv.js            # Importa a planilha "Clientes Geral" em CSV
│   ├── import-faturamento.js    # Importa histórico de faturamento (planilha 2026)
│   ├── import-desligamento.js   # Cadastra clientes desligados com data de saída
│   └── corrigir-duplicados.js   # Mescla clientes duplicados (nome repetido)
├── docs/
│   ├── DEPLOY.md          # Guia de deploy e operação
│   ├── MANUAL.md          # Manual do usuário
│   └── Manual-do-Usuario.docx
└── public/
    ├── login.html         # Tela de login (com olho de mostrar/ocultar senha)
    ├── dashboard.html     # Métricas + alertas
    ├── clientes.html      # Lista, filtros, ordenação e CRUD de clientes
    ├── pessoas.html       # Visão por membro da equipe (com filtro por função)
    ├── faturamento.html   # Meta x faturamento por cliente, com gráficos e PDF
    ├── relatorios.html    # Central de relatórios em PDF (carteira, churn, carga)
    ├── configuracoes.html # Equipe + contas de acesso (só admin)
    ├── css/style.css      # Tema escuro/claro compartilhado + responsivo mobile
    └── js/app.js          # Utilidades compartilhadas (api, sidebar, menu mobile)
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

**Cliente** (`clientes.json`): `id`, `agencyId`, `nome` (marca + unidade, ex.: "Fast Escova Aclimação"), `marca` (para filtro; vazio quando "Outro"), `status` (`ativo` | `prelancamento` | `saindo` — o status "Ativo OK" foi removido, tudo que era "ativo_ok" virou "ativo"), `responsaveis` ({ `atendimento` (Estrategista de Atendimento), `planejamento` (Estrategista de Planejamento), `copy` (Copywriter), `apoio`, `consultor` (Consultor/Gerente), `socialMedia`, `edicaoVideos` } — texto livre; `"EQUIPE PRÓPRIA"` indica que o próprio cliente cuida, `"NÃO TEM"` (disponível em `apoio`, `consultor`, `socialMedia`, `edicaoVideos`) indica que esse serviço não faz parte do contrato; vazio = pendência), `artesSemanais` (número ou null — quantas artes por semana o contrato inclui), `acessoTrafego` (bool), `dataInauguracao`, `dataSaida`, `aniversario` (aniversário da unidade, gera alerta anual) e `dataEntrada` (`AAAA-MM-DD` ou null), `obs`, `criadoEm`, `atualizadoEm`. O status efetivo (`statusEfetivoSrv`) é sempre calculado a partir das datas — nunca setado manualmente para as transições de pré-lançamento/saindo/saiu.

**Usuário** (`usuarios.json`): `id`, `agencyId`, `login`, `senhaHash` (bcrypt), `nome`, `papel` (`admin` | `gestor`), `funcao` (função operacional do gestor, ex.: `atendimento` — usada para liberar acesso ao Faturamento), `membroNome` (gestores: nome do membro da equipe usado para filtrar a visão), `criadoEm`.

**Equipe** (`equipe.json`): `id`, `agencyId`, `nome`, `funcao`.

**Faturamento** (`faturamento.json`): `id`, `agencyId`, `clienteId`, `mes` (`AAAA-MM`), `meta`, `faturamento`, `ticketMedio`, `criadoEm`, `atualizadoEm`. Um registro por cliente/mês (upsert pela chave `clienteId`+`mes`).

## API

Todas as rotas retornam JSON; erros vêm como `{ "erro": "mensagem" }`. As de relatório (`.pdf`) retornam o arquivo binário direto.

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
| GET | `/api/pessoas` | logado | Clientes agrupados por responsável, com funções (Consultor/Gerente não entra, pois é da equipe do cliente) |
| GET | `/api/equipe` | logado | Lista membros |
| POST / DELETE | `/api/equipe[/:id]` | admin | Adiciona / remove membro |
| GET / POST | `/api/usuarios` | admin | Lista / cria contas (nunca retorna hash) |
| PUT / DELETE | `/api/usuarios/:id` | admin | Edita (inclui reset de senha) / exclui conta |
| GET | `/api/meta` | logado | Funções e status válidos (para o frontend) |
| GET | `/api/faturamento/clientes` | admin + atendimento | Clientes visíveis para lançar faturamento |
| GET | `/api/faturamento/:clienteId` | admin + atendimento (do próprio cliente) | Histórico mensal do cliente |
| POST | `/api/faturamento` | admin + atendimento (do próprio cliente) | Cria/atualiza o lançamento de um mês |
| GET | `/api/relatorios/carteira.pdf` | admin | Relatório mensal da carteira (`?mes=AAAA-MM`) |
| GET | `/api/relatorios/churn.pdf` | admin | Relatório de churn (saídas, permanência média) |
| GET | `/api/relatorios/carga-pessoa.pdf` | admin | Produtividade (clientes ativos) por pessoa |
| GET | `/api/relatorios/faturamento-cliente.pdf` | admin + atendimento (do próprio cliente) | Relatório de faturamento de um cliente (`?clienteId=`) |

Páginas HTML (exceto `login.html`) redirecionam para o login quando não há sessão.

## Regras de permissão

**Admin**: vê e edita tudo; gerencia equipe, contas, faturamento de todos os clientes e os relatórios em PDF. **Gestor**: só enxerga clientes onde o `membroNome` vinculado aparece em alguma função; não edita nada (a API bloqueia com 403 e a interface esconde os botões). **Gestor com função "Estrategista de Atendimento"**: além da visão normal, acessa a tela de Faturamento — mas só dos clientes onde ele é o responsável de Atendimento (não qualquer cliente que apareça em qualquer função dele).

## Importar a planilha atual

Exporte a aba **"Clientes Geral"** como CSV (com a aba aberta: Arquivo → Fazer download → CSV) e rode:

```
node scripts/import-csv.js caminho/da/planilha.csv
```

O script monta o nome como marca + unidade ("Fast Escova Aclimação"; marca "Outro" usa só a unidade), converte datas dd/mm/aaaa, separa nomes compostos ("Juliana/Paula" vira dois membros), transforma **"A confirmar" em campo vazio** (que aparece como pendência no dashboard) e gera `data/clientes.json` + `data/equipe.json`. Revise o resultado após importar.

## Outros scripts de importação e manutenção

```
npm run import-faturamento     # Importa o histórico de faturamento de uma planilha CSV
npm run import-desligamento    # Cadastra clientes desligados (lista embutida no script) com data de saída
npm run corrigir-duplicados    # Encontra clientes com nome repetido e mescla num só registro
```

O `import-desligamento` e o `corrigir-duplicados` **alteram `data/clientes.json` diretamente** — rode sempre com `data/` já com backup recente, e rode uma vez só (rodar de novo não deveria duplicar nada, mas se o processo for interrompido no meio, `corrigir-duplicados` resolve automaticamente qualquer duplicidade de nome que sobrar).

## Avisos importantes

Sessões ficam em memória: **todo redeploy derruba os logins** — a equipe precisa entrar de novo. Os JSONs em `data/` (incluindo `faturamento.json`) são os dados de produção: configure um **Volume no Railway** e faça **backup regular** (ver `docs/DEPLOY.md`). Nunca commite `.env` nem `data/`. O layout é responsivo: funciona no celular, com menu em gaveta (☰) no lugar da barra lateral fixa.

## Pendências conhecidas

Ainda não existe "esqueci minha senha" (o admin reseta manualmente em Configurações) nem uma tela de "Minha Conta" para o próprio usuário trocar a senha sem depender do admin. A integração com o ClickUp (criar cliente direto de lá) está mapeada mas não iniciada — depende de alinhamento com o time sobre o que deve ser automático entre as plataformas.

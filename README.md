# ✨ Controle de Clientes — Beleza Boost

App web de controle de clientes da carteira de uma agência de tráfego pago. Substitui a planilha "Clientes e Responsáveis" por um sistema com login, permissões, alertas, visão por pessoa, faturamento por cliente e relatórios em PDF.

## Stack

Node.js + Express em um único `server.js`. Frontend em HTML/CSS/JS puro (sem framework), um HTML por tela em `/public`, responsivo (desktop e mobile). Login por usuário e senha (bcryptjs) com sessões em memória (express-session). Dados num banco Postgres hospedado no **Supabase** (com backup automático) — acesso via `db.js` (pacote `pg`). Gráficos com Chart.js (CDN) e relatórios em PDF com `pdfkit`. Deploy no Railway via Dockerfile (`node:20-slim`).

## Estrutura de pastas

```
controle-carteira/
├── server.js              # Todo o backend (rotas, auth, PDFs)
├── db.js                  # Acesso ao banco Postgres (Supabase) — schema + queries
├── package.json
├── Dockerfile
├── .env.example           # Modelo de variáveis (copie para .env)
├── .gitignore             # .env e data/ NUNCA vão para o Git
├── data/                  # Só usada localmente/como backup de exportação (JSON, fora do Git)
│   ├── usuarios.json      # Contas de login (senhas com hash bcrypt)
│   ├── clientes.json      # Carteira de clientes
│   ├── equipe.json        # Membros da equipe (dropdowns)
│   └── faturamento.json   # Lançamentos mensais de meta/faturamento por cliente
├── scripts/
│   ├── import-csv.js            # Importa a planilha "Clientes Geral" em CSV
│   ├── import-faturamento.js    # Importa histórico de faturamento (planilha 2026)
│   ├── import-desligamento.js   # Cadastra clientes desligados com data de saída
│   ├── corrigir-duplicados.js   # Mescla clientes duplicados (nome repetido)
│   └── migrar-supabase.js       # Copia os JSONs de data/ para o banco Postgres (roda uma vez)
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
| `DATABASE_URL` | — | Connection string do Postgres (Supabase). Obrigatória — sem ela o app não sobe |
| `DATA_DIR` | ./data | Só usada pelos scripts de importação/migração (JSON local) |

## Modelo de dados

Todos os registros carregam `agencyId` (hoje sempre `"default"`) — preparação para multi-tenant/SaaS: quando houver mais agências, basta filtrar por `agencyId` (os filtros já existem em todas as consultas).

**Cliente** (`clientes.json`): `id`, `agencyId`, `nome` (marca + unidade, ex.: "Fast Escova Aclimação"), `marca` (para filtro; vazio quando "Outro"), `status` (`ativo` | `prelancamento` | `saindo` — o status "Ativo OK" foi removido, tudo que era "ativo_ok" virou "ativo"), `responsaveis` ({ `atendimento` (Estrategista de Atendimento), `planejamento` (Estrategista de Planejamento), `copy` (Copywriter), `apoio`, `consultor` (Consultor/Gerente), `socialMedia`, `edicaoVideos` } — texto livre; `"EQUIPE PRÓPRIA"` indica que o próprio cliente cuida, `"NÃO TEM"` (disponível em `apoio`, `consultor`, `socialMedia`, `edicaoVideos`) indica que esse serviço não faz parte do contrato; vazio = pendência), `artesSemanais` (número ou null — quantas artes por semana o contrato inclui), `acessoTrafego` (bool), `dataInauguracao`, `dataSaida`, `aniversario` (aniversário da unidade, gera alerta anual) e `dataEntrada` (`AAAA-MM-DD` ou null), `obs`, `criadoEm`, `atualizadoEm`. O status efetivo (`statusEfetivoSrv`) é sempre calculado a partir das datas — nunca setado manualmente para as transições de pré-lançamento/saindo/saiu.

**Usuário** (`usuarios.json`): `id`, `agencyId`, `login`, `senhaHash` (bcrypt), `nome`, `papel` (`admin` | `gestor` | `comercial` | `trafego`), `funcao` (função operacional do gestor, ex.: `atendimento` — usada para liberar acesso ao Faturamento; sempre `null` para admin, comercial e trafego), `membroNome` (gestores: nome do membro da equipe usado para filtrar a visão; sempre `null` para admin, comercial e trafego), `criadoEm`.

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
| POST | `/api/clientes` | admin, comercial | Cria cliente |
| PUT | `/api/clientes/:id` | admin, comercial, trafego | Atualiza cliente (papel `trafego`: servidor aceita só o campo `acessoTrafego`, ignora qualquer outro campo enviado) |
| DELETE | `/api/clientes/:id` | admin | Exclui cliente |
| GET | `/api/alertas` | logado | `{inauguracoes, aniversarios, saidas, pendencias, semAcesso}` sobre os clientes visíveis |
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

**Admin**: vê e edita tudo; gerencia equipe, contas, faturamento de todos os clientes e os relatórios em PDF. **Comercial**: enxerga a carteira inteira (igual admin) e pode cadastrar e editar clientes, mas não exclui cliente e não acessa equipe, contas, faturamento nem relatórios (só o admin faz isso). **Gestor de Tráfego** (papel `trafego` — atenção, é um papel diferente do "Gestor" comum abaixo, mesmo tendo nome parecido): enxerga a carteira inteira (igual admin), mas só pode alterar o campo **Acesso de Tráfego** (Sim/Não) de cada cliente — não cadastra cliente novo, não edita mais nada no cadastro, não exclui, e não acessa equipe, contas, faturamento nem relatórios. Essa restrição é aplicada no servidor (não só escondida na tela): qualquer outro campo enviado na requisição é ignorado. **Gestor** (papel `gestor`): só enxerga clientes onde o `membroNome` vinculado aparece em alguma função; não edita nada (a API bloqueia com 403 e a interface esconde os botões). Cada gestor tem uma função específica (Estrategista de Atendimento, Planejamento, Copywriter, Apoio, Social Media ou Edição de Vídeos) — é esse grupo que a documentação de negócio costuma chamar genericamente de "Gestor de Tráfego", mas no sistema o papel técnico deles é `gestor`, não `trafego`. **Gestor com função "Estrategista de Atendimento"**: além da visão normal, acessa a tela de Faturamento — mas só dos clientes onde ele é o responsável de Atendimento (não qualquer cliente que apareça em qualquer função dele).

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
npm run migrar-supabase        # Copia os JSONs de data/ para o banco Postgres (roda uma vez só)
```

Os scripts de importação/manutenção continuam lendo e escrevendo em `data/*.json` (mais simples de rodar localmente). Depois de rodar qualquer um deles, rode `npm run migrar-supabase` de novo para levar o resultado pro banco — rodar de novo não duplica nada, apenas atualiza.

O `import-desligamento` e o `corrigir-duplicados` **alteram `data/clientes.json` diretamente** — rode sempre com `data/` já com backup recente, e rode uma vez só (rodar de novo não deveria duplicar nada, mas se o processo for interrompido no meio, `corrigir-duplicados` resolve automaticamente qualquer duplicidade de nome que sobrar).

## Avisos importantes

O servidor calcula "hoje" sempre no fuso de Brasília (`hojeBR()` em `server.js`), independente do fuso do container (o Railway roda em UTC por padrão) — sem isso, alertas de aniversário/inauguração e a virada automática de status (pré-lançamento → ativo, ativo → saiu) adiantavam quase 3 horas.

Sessões ficam em memória: **todo redeploy derruba os logins** — a equipe precisa entrar de novo. Os dados de produção ficam no banco Postgres do Supabase, que já faz backup automático. Nunca commite `.env` nem `data/`. O layout é responsivo: funciona no celular, com menu em gaveta (☰) no lugar da barra lateral fixa.

## Pendências conhecidas

Ainda não existe "esqueci minha senha" (o admin reseta manualmente em Configurações) nem uma tela de "Minha Conta" para o próprio usuário trocar a senha sem depender do admin. A integração com o ClickUp (criar cliente direto de lá) está mapeada mas não iniciada — depende de alinhamento com o time sobre o que deve ser automático entre as plataformas.

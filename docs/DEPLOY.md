# 🚀 Guia de Deploy e Operação — Controle de Clientes

Passo a passo para colocar o app no ar no Railway com auto-deploy via GitHub, no mesmo padrão do app de informes.

## 1. Subir o código para o GitHub

No PowerShell 5.1, **um comando por linha** (nunca use `&&`):

```
cd controle-carteira
git init
git add .
git commit -m "Versao inicial do Controle de Clientes"
```

Crie um **repositório privado** no GitHub (ex.: `controle-carteira`) e conecte:

```
git remote add origin https://github.com/SEU-USUARIO/controle-carteira.git
git branch -M main
git push -u origin main
```

Antes do primeiro push, confirme que `git status` NÃO lista `.env` nem `data/` — os dois estão no `.gitignore` e contêm senhas e dados de clientes.

## 2. Criar o projeto no Railway

No Railway: **New Project → Deploy from GitHub repo** → selecione o repositório. O Railway detecta o `Dockerfile` e faz o build com `node:20-slim` automaticamente. Todo `git push` na branch `main` dispara um novo deploy (auto-deploy).

## 3. Variáveis de ambiente (Railway Variables)

No serviço → aba **Variables**, crie:

| Variável | Valor |
|---|---|
| `DATABASE_URL` | Connection string do Postgres (Supabase → Project Settings → Database → Connection string → modo "Agrupador de sessões"/Session pooler, URI). Obrigatória — sem ela o app não sobe |
| `SESSION_SECRET` | Um texto aleatório longo (ex.: gere em https://randomkeygen.com) |
| `ADMIN_LOGIN` | Login do primeiro admin (ex.: `juninho`) — só é usado se o banco estiver totalmente vazio |
| `ADMIN_SENHA` | Senha forte para o primeiro admin |
| `ALERTA_DIAS_INAUGURACAO` | `15` (ou o que preferir) |
| `ALERTA_DIAS_ANIVERSARIO` | `30` (antecedência do alerta de aniversário de unidade) |

`PORT` não precisa: o Railway injeta sozinho.

Use a opção **"Agrupador de sessões" (Session pooler)** do Supabase, não a "Conexão direta" — a conexão direta usa IPv6, que pode não funcionar no Railway. O agrupador de sessões usa IPv4 e é a opção recomendada para apps que ficam rodando o tempo todo (como este).

## 4. Banco de dados (Supabase)

Os dados vivem num banco Postgres no [Supabase](https://supabase.com) — com backup automático, sem depender de Volume nem de cópias manuais. Crie um projeto lá (organização → New Project → escolha uma senha forte para o banco e guarde em local seguro → região "South America (São Paulo)" se disponível), pegue a connection string do passo 3 e cole em `DATABASE_URL` no Railway.

Se o app ainda tem dados antigos em `data/*.json` guardados num Volume do Railway (de antes da migração pro Supabase), **não precisa copiar nada na mão**: assim que o app subir com `DATABASE_URL` configurada e o banco estiver vazio, ele detecta o `clientes.json` antigo e migra tudo sozinho automaticamente, uma única vez, antes de começar a atender pedidos. Depois disso o Volume deixa de ser necessário (pode manter por segurança/histórico, sem problema).

## 5. Primeiro acesso

Abra a URL gerada pelo Railway (Settings → Networking → Generate Domain). Entre com `ADMIN_LOGIN`/`ADMIN_SENHA`. Vá em **⚙️ Configurações** e: cadastre os membros da equipe, crie as contas de acesso (e o seu próprio usuário definitivo, se quiser), e teste com um gestor.

## 6. Importar a planilha ou fazer manutenção em massa

Os scripts de importação (`import-csv.js`, `import-faturamento.js`, `import-desligamento.js`, `corrigir-duplicados.js`, `atualizar-servicos.js`) continuam lendo e escrevendo em `data/*.json` — mais simples de rodar e conferir localmente antes de mexer em dados de produção. Fluxo recomendado:

```
node scripts/import-csv.js planilha.csv     # (ou o script que for usar)
npm run migrar-supabase                     # envia o resultado pro banco Postgres
```

`migrar-supabase` lê `.env` local (precisa ter `DATABASE_URL` apontando pro Supabase de produção) e sincroniza tudo — rodar de novo não duplica nada, só atualiza. Rode sempre com cuidado: como aponta direto pro banco de produção, confira o resultado do script de importação em `data/clientes.json` antes de rodar a migração.

## 7. Operação do dia a dia

**Relogin após deploy**: as sessões ficam em memória — a cada redeploy todo mundo é deslogado e precisa entrar de novo. Avise a equipe.

**Backup**: o Supabase faz backup automático do banco (confira a frequência incluída no seu plano em Project Settings → Database → Backups). Não depende mais de baixar JSONs manualmente.

**Reset de senha**: o admin edita o usuário em Configurações e define uma nova senha. Não existe "esqueci minha senha" por e-mail nesta fase (fica no backlog).

**Faturamento**: acessível por Admin e por quem tem a função "Estrategista de Atendimento" vinculada (e só dos clientes onde é o responsável de Atendimento). Os lançamentos mensais (meta, faturamento, ticket médio) são digitados manualmente — não há integração automática com nenhuma plataforma de pagamento ainda.

**Admin trancado para fora**: se perder a senha do único admin, apague a linha correspondente na tabela `usuarios` pelo **Table Editor do Supabase** e reinicie o serviço no Railway — o admin inicial é recriado a partir das variáveis `ADMIN_LOGIN`/`ADMIN_SENHA` (os demais usuários precisarão ser recriados; clientes e equipe não são afetados).

## 8. Checklist de segurança

`.env` e `data/` fora do Git (já garantido pelo `.gitignore`). `DATABASE_URL` e `SESSION_SECRET` fortes em produção. Senha do admin inicial trocada após o primeiro login. Repositório GitHub privado. Acesso ao painel do Supabase restrito a quem precisa.

## Futuro (já preparado no código)

**Multi-tenant/SaaS**: todo registro tem `agencyId` e todas as consultas já filtram por ele — para atender outras agências, basta criar registros com outro `agencyId` e ajustar o cadastro de usuários.

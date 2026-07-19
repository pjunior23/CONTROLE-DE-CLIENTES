# 🚀 Guia de Deploy e Operação — Controle de Carteira

Passo a passo para colocar o app no ar no Railway com auto-deploy via GitHub, no mesmo padrão do app de informes.

## 1. Subir o código para o GitHub

No PowerShell 5.1, **um comando por linha** (nunca use `&&`):

```
cd controle-carteira
git init
git add .
git commit -m "Versao inicial do Controle de Carteira"
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
| `SESSION_SECRET` | Um texto aleatório longo (ex.: gere em https://randomkeygen.com) |
| `ADMIN_LOGIN` | Login do primeiro admin (ex.: `juninho`) |
| `ADMIN_SENHA` | Senha forte para o primeiro admin |
| `ALERTA_DIAS_INAUGURACAO` | `15` (ou o que preferir) |
| `ALERTA_DIAS_ANIVERSARIO` | `30` (antecedência do alerta de aniversário de unidade) |
| `DATA_DIR` | `/data` (junto com o Volume do passo 4) |

`PORT` não precisa: o Railway injeta sozinho.

## 4. Volume para os dados (essencial!)

Sem volume, **os JSONs são apagados a cada deploy** (o container é recriado do zero). No serviço: **Settings → Volumes → Add Volume**, monte em `/data`. Com `DATA_DIR=/data`, os arquivos `usuarios.json`, `clientes.json` e `equipe.json` passam a viver no volume e sobrevivem aos deploys.

## 5. Primeiro acesso

Abra a URL gerada pelo Railway (Settings → Networking → Generate Domain). Entre com `ADMIN_LOGIN`/`ADMIN_SENHA`. Vá em **⚙️ Configurações** e: cadastre os membros da equipe, crie as contas de acesso (e o seu próprio usuário definitivo, se quiser), e teste com um gestor.

## 6. Importar a planilha

Localmente: exporte a aba do Google Sheets como CSV, rode `node scripts/import-csv.js planilha.csv` e revise `data/clientes.json`. Para levar ao Railway, a forma mais simples é copiar o conteúdo dos JSONs gerados para dentro do volume usando o console do Railway (ou refazer a importação direto lá). Alternativa prática: rodar o app localmente já com os dados importados, conferir tudo, e só então subir os arquivos.

## 7. Operação do dia a dia

**Relogin após deploy**: as sessões ficam em memória — a cada redeploy todo mundo é deslogado e precisa entrar de novo. Avise a equipe.

**Backup**: os JSONs em `/data` são os dados de produção. Baixe cópias periodicamente (semanal, no mínimo) e guarde em local seguro. Quando migrar para Supabase, isso deixa de ser necessário.

**Reset de senha**: o admin edita o usuário em Configurações e define uma nova senha. Não existe "esqueci minha senha" por e-mail nesta fase.

**Admin trancado para fora**: se perder a senha do único admin, apague o `usuarios.json` do volume e reinicie o serviço — o admin inicial é recriado a partir das variáveis `ADMIN_LOGIN`/`ADMIN_SENHA` (os demais usuários precisarão ser recriados; clientes e equipe não são afetados).

## 8. Checklist de segurança

`.env` e `data/` fora do Git (já garantido pelo `.gitignore`). `SESSION_SECRET` forte em produção. Senha do admin inicial trocada após o primeiro login. Repositório GitHub privado. Backups periódicos do volume.

## Futuro (já preparado no código)

**Multi-tenant/SaaS**: todo registro tem `agencyId` e todas as consultas já filtram por ele — para atender outras agências, basta criar registros com outro `agencyId` e ajustar o cadastro de usuários. **Supabase**: a camada de dados está isolada nas funções `loadJSON`/`saveJSON` do `server.js`; trocar por Postgres/Supabase não afeta rotas nem frontend.

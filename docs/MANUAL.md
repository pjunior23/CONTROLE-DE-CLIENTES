# 📖 Manual do Usuário — Controle de Clientes

Este é o guia da equipe para usar o Controle de Clientes, o sistema que substitui a planilha "Clientes e Responsáveis". Aqui você aprende a entrar, consultar seus clientes, entender os alertas e (se for administrador) manter tudo atualizado.

## Entrando no sistema

Abra o endereço do sistema no navegador, digite seu **login** e sua **senha** e clique em **🔑 Entrar**. Quem cria e entrega o login e a senha é o administrador — não existe cadastro por conta própria. Se errar a senha, o sistema avisa; se esquecer, peça ao administrador para definir uma nova.

Importante: de vez em quando o sistema é atualizado e todo mundo é desconectado ao mesmo tempo. Isso é normal — basta entrar de novo.

## Os dois tipos de acesso

**👑 Administrador** vê a carteira completa, cadastra e edita clientes, gerencia a equipe e as contas de acesso.

**📈 Gestor de Tráfego** vê apenas os clientes em que aparece como responsável em alguma função. A visão é de consulta: se algum dado estiver errado, avise o administrador para corrigir.

## 📊 Dashboard

É a primeira tela após o login. Mostra os números da carteira (total de clientes, ativos, em inauguração e saindo) e a lista de **alertas**:

🎉 **Inaugurações próximas** — clientes em pré-lançamento com inauguração nos próximos 15 dias. 🎂 **Aniversários de unidade** — unidades que fazem aniversário nos próximos 30 dias, para planejar campanha comemorativa. 👋 **Clientes saindo** — quem está de saída e a data, para organizar a transição. ⚠️ **Pendências** — clientes com alguma função sem responsável definido (inclui os que estavam "A confirmar" na planilha) ou sem acesso de tráfego liberado. A meta é manter essa lista zerada.

## 👥 Clientes

A versão digital da planilha. Cada linha mostra o cliente, o status, os principais responsáveis e se o acesso de tráfego está liberado.

**Status possíveis**: 🟣 Ativo (operação normal) · 🟢 Ativo OK (ativo e com tudo em dia) · 🟡 Em Inauguração (inauguração a caminho) · 🔴 Saindo (encerrando contrato).

**Buscar e filtrar**: use a caixa 🔍 para buscar pelo nome, o filtro de status, o filtro por marca (Fast Escova, Fast Spa, Mega Studio...) e o filtro por pessoa (ex.: escolha "Marcela" para ver só os clientes dela).

**Cadastrar ou editar (só admin)**: clique em **➕ Novo Cliente** ou em qualquer linha da tabela. No formulário você define nome (padrão: marca + unidade, ex.: "Fast Escova Aclimação"), marca, status, o responsável de cada função (Estrategista de Atendimento, Estrategista de Planejamento, Copywriter, Apoio, Consultor/Gerente, Social Media e Edição de Vídeos — use "EQUIPE PRÓPRIA" quando o próprio cliente cuida), as datas de inauguração, saída, aniversário da unidade e entrada na carteira, o acesso de tráfego e observações. Os nomes dos dropdowns vêm do cadastro de equipe em Configurações.

**Excluir (só admin)**: dentro da edição, botão 🗑️ Excluir. O sistema pede confirmação — a exclusão não pode ser desfeita.

## 🧑‍💼 Por Pessoa

Mostra a carteira de cada membro da equipe: quantos clientes atende e em quais funções. Use para equilibrar a carga na hora de distribuir um cliente novo ou remanejar a equipe.

## ⚙️ Configurações (só admin)

**Membros da Equipe**: a lista de nomes que aparece nos dropdowns de responsáveis. Cadastre todo mundo antes de montar os clientes. Remover um membro não altera os clientes já cadastrados.

**Contas de Acesso**: onde se criam os logins. Para um gestor, escolha o papel "Gestor de Tráfego" e **vincule ao membro da equipe correspondente** — é esse vínculo que define quais clientes ele enxerga. Para trocar uma senha, edite o usuário e digite a nova senha (deixe em branco para manter a atual). Você não consegue excluir a própria conta.

## Perguntas frequentes

**Não estou vendo nenhum cliente.** Se você é gestor, seu usuário provavelmente não está vinculado ao membro certo da equipe — peça ao administrador para conferir em Configurações.

**Um cliente está com dado errado e não consigo editar.** Somente administradores editam. Avise o seu administrador.

**Fui desconectado do nada.** O sistema foi atualizado. Entre de novo com o mesmo login e senha.

**Posso usar no celular?** Sim, pelo navegador. A experiência é melhor no computador.


## Novidades da versão 2

**Histórico de saídas**: cliente com status Saindo continua contando como ativo. Quando a data de saída passa, ele sai da lista automaticamente e vai para o filtro "📁 Histórico (saíram)" — nada é excluído, então dá para consultar quem já saiu (e quem pedir para voltar).

**Cards clicáveis**: no Dashboard, clicar em qualquer card (Ativos, Em Inauguração, Saindo, Histórico) abre a lista de clientes já filtrada.

**Alertas organizados**: os alertas ficam em seções recolhíveis (Inaugurações, Aniversários, Saindo, Pendências), cada uma com contador.

**Tema claro/escuro**: botão 🌓 Tema na sidebar; a escolha fica salva no seu navegador.

**Responsáveis por função**: no cadastro do cliente, cada dropdown mostra apenas os colaboradores daquela função (definida em Configurações). Consultor tem a opção "NÃO TEM" para clientes sem consultor — sem gerar pendência.

**Acesso a partir do colaborador**: em Configurações, o botão 🔑 Criar acesso gera a conta do membro com login sugerido pelo primeiro nome (ex.: Juliana → juliana).

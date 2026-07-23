# 📖 Manual do Usuário — Controle de Clientes

Este é o guia da equipe para usar o Controle de Clientes, o sistema que substitui a planilha "Clientes e Responsáveis". Aqui você aprende a entrar, consultar seus clientes, entender os alertas e (se for administrador) manter tudo atualizado.

## Entrando no sistema

Abra o endereço do sistema no navegador, digite seu **login** e sua **senha** e clique em **🔑 Entrar**. Tem um ícone de olho 👁️ no campo de senha pra você conferir o que digitou antes de enviar. Quem cria e entrega o login e a senha é o administrador — não existe cadastro por conta própria nem "esqueci minha senha" por enquanto; se esquecer, peça ao administrador para definir uma nova em Configurações.

Importante: de vez em quando o sistema é atualizado e todo mundo é desconectado ao mesmo tempo. Isso é normal — basta entrar de novo. Funciona também pelo celular: o menu vira uma gaveta lateral, acessada pelo ícone ☰ no topo.

## Os tipos de acesso

**👑 Administrador** vê a carteira completa, cadastra e edita clientes, gerencia a equipe e as contas de acesso, lança faturamento de qualquer cliente e baixa todos os relatórios.

**📈 Gestor de Tráfego** vê apenas os clientes em que aparece como responsável em alguma função. A visão é de consulta: se algum dado estiver errado, avise o administrador para corrigir.

**💰 Estrategista de Atendimento** é um Gestor de Tráfego com a função "Estrategista de Atendimento" marcada no cadastro. Além da visão normal de Gestor, ele também acessa a tela de **Faturamento**, mas só dos clientes onde ele é o responsável de Atendimento.

## 📊 Dashboard

É a primeira tela após o login. Mostra os números da carteira (total de clientes, ativos, em inauguração e saindo) e a lista de **alertas**:

🎉 **Inaugurações próximas** — clientes em pré-lançamento com inauguração nos próximos 15 dias. 🎂 **Aniversários de unidade** — unidades que fazem aniversário nos próximos 30 dias, para planejar campanha comemorativa. 👋 **Clientes saindo** — quem está de saída e a data, para organizar a transição. ⚠️ **Pendências** — clientes com alguma função sem responsável definido (inclui os que estavam "A confirmar" na planilha) ou sem acesso de tráfego liberado. A meta é manter essa lista zerada.

## 👥 Clientes

A versão digital da planilha. Cada linha mostra o cliente, o status, os principais responsáveis e se o acesso de tráfego está liberado. Clientes que já saíram (data de saída no passado) não aparecem na lista normal — vão para o filtro "📁 Histórico (saíram)".

**Status possíveis**: 🟢 Ativo (operação normal) · 🟡 Em Inauguração (inauguração a caminho, calculado automaticamente pela data) · 🔴 Saindo (data de saída futura, também automático). O antigo status "Ativo OK" foi removido — todo mundo que era "Ativo OK" virou simplesmente "Ativo".

**Buscar, filtrar e ordenar**: use a caixa 🔍 para buscar pelo nome, o filtro de status, o filtro por marca (Fast Escova, Fast Spa, Mega Studio...) e o filtro por pessoa (ex.: escolha "Marcela" para ver só os clientes dela). Tem também um seletor de **ordem**: alfabética, saída mais recente primeiro ou saída mais antiga primeiro — útil pra revisar o histórico de quem saiu.

**Cadastrar ou editar (só admin)**: clique em **➕ Novo Cliente** ou em qualquer linha da tabela. No formulário você define nome (padrão: marca + unidade, ex.: "Fast Escova Aclimação"), marca, status, o responsável de cada função (Estrategista de Atendimento, Estrategista de Planejamento, Copywriter, Apoio, Consultor/Gerente, Social Media e Edição de Vídeos), as datas de inauguração, saída, aniversário da unidade e entrada na carteira, quantas **artes semanais** o contrato inclui, o acesso de tráfego e observações. Nos campos de Apoio, Consultor, Social Media e Edição de Vídeos tem duas opções especiais: **"EQUIPE PRÓPRIA"** quando é o time do próprio cliente que cuida, e **"NÃO TEM"** quando esse serviço simplesmente não faz parte do contrato — nos dois casos não vira pendência no dashboard. Os nomes dos dropdowns vêm do cadastro de equipe em Configurações. Também dá pra chegar direto num cliente clicando na linha dele na tela **Por Pessoa**.

**Coluna Serviços**: mostra de relance o que a agência faz por aquele cliente — 📱 Social Media e 🎬 Edição de Vídeo aparecem coloridos quando é a agência que executa, com 🏠 quando é a equipe própria do cliente, e 🎨 com a quantidade de artes semanais contratadas. Serviço marcado como "NÃO TEM" simplesmente não aparece.

**Excluir (só admin)**: dentro da edição, botão 🗑️ Excluir. O sistema pede confirmação — a exclusão não pode ser desfeita.

## 🧑‍💼 Por Pessoa

Mostra a carteira de cada membro da equipe: quantos clientes atende e em quais funções. Use para equilibrar a carga na hora de distribuir um cliente novo ou remanejar a equipe. Tem um filtro por **função** pra ver só quem faz Atendimento, Planejamento, Copy etc. O Consultor/Gerente não aparece aqui — é alguém da equipe do próprio cliente, não do time da agência. Clicando em qualquer cliente da lista, o sistema já abre a edição dele direto.

## 💰 Faturamento (Admin e Estrategista de Atendimento)

Tela pra acompanhar meta x faturamento real de cada cliente, mês a mês. Use o campo **🔍 Buscar cliente...** pra digitar e encontrar o cliente (ele filtra a lista conforme você digita). Depois de escolher:

**Lançar o mês**: preencha meta, faturamento e ticket médio do mês desejado e clique em **💾 Salvar mês**. Se já existir um lançamento pra aquele mês, ele é atualizado (clique na linha da tabela de histórico pra editar um mês já lançado).

**Cards do topo**: mostram meta total, faturado, diferença e % da meta atingida do mês atual. Ficam zerados até alguém lançar o primeiro mês daquele cliente.

**Gráficos**: barras de meta x faturamento e a evolução do ticket médio ao longo dos meses lançados.

**🔗 Copiar link do cliente**: copia um link direto pra tela de Faturamento já com aquele cliente selecionado — útil pra mandar pro próprio cliente ou pra quem só precisa ver aquele caso.

**📄 Baixar PDF do cliente**: gera um relatório em PDF com o histórico completo daquele cliente — números, gráfico de evolução mês a mês e tabela detalhada. Só quem tem acesso ao cliente (Admin, ou o Estrategista de Atendimento responsável) consegue baixar.

## 📑 Relatórios (só admin)

Central de relatórios em PDF pra compartilhar com o time ou a diretoria:

**Relatório Mensal da Carteira**: escolha o mês e baixe — traz quantos clientes ativos, quantos entraram e saíram naquele mês, quantos estão em inauguração, e o faturamento total (meta x real) do período.

**Relatório de Churn**: total de clientes que já saíram da carteira, permanência média (em meses) e um gráfico de saídas por mês.

**Produtividade por Pessoa**: a mesma informação da tela Por Pessoa, em formato de tabela pra impressão/PDF.

## ⚙️ Configurações (só admin)

**Membros da Equipe**: a lista de nomes que aparece nos dropdowns de responsáveis. Cadastre todo mundo antes de montar os clientes. Remover um membro não altera os clientes já cadastrados.

**Contas de Acesso**: onde se criam os logins. Para um gestor, escolha o papel "Gestor de Tráfego", **vincule ao membro da equipe correspondente** (define quais clientes ele enxerga) e, se for o caso, marque a função "Estrategista de Atendimento" pra liberar o acesso ao Faturamento. Para trocar uma senha, edite o usuário e digite a nova senha (deixe em branco para manter a atual). Você não consegue excluir a própria conta.

## Perguntas frequentes

**Não estou vendo nenhum cliente.** Se você é gestor, seu usuário provavelmente não está vinculado ao membro certo da equipe — peça ao administrador para conferir em Configurações.

**Um cliente está com dado errado e não consigo editar.** Somente administradores editam. Avise o seu administrador.

**Fui desconectado do nada.** O sistema foi atualizado. Entre de novo com o mesmo login e senha.

**Posso usar no celular?** Sim — o layout se adapta e o menu vira uma gaveta lateral (ícone ☰). Funciona bem, mas telas com muita tabela (como Clientes) ainda são mais confortáveis no computador.

**Não vejo o menu de Faturamento.** Só aparece pra Admin e para quem tem a função "Estrategista de Atendimento" marcada no cadastro de usuário. Peça ao administrador para conferir em Configurações.

**Esqueci minha senha.** Ainda não existe recuperação automática — peça ao administrador para definir uma nova em Configurações.


## Novidades da versão 2

**Histórico de saídas**: cliente com status Saindo continua contando como ativo. Quando a data de saída passa, ele sai da lista automaticamente e vai para o filtro "📁 Histórico (saíram)" — nada é excluído, então dá para consultar quem já saiu (e quem pedir para voltar).

**Cards clicáveis**: no Dashboard, clicar em qualquer card (Ativos, Em Inauguração, Saindo, Histórico) abre a lista de clientes já filtrada.

**Alertas organizados**: os alertas ficam em seções recolhíveis (Inaugurações, Aniversários, Saindo, Pendências), cada uma com contador.

**Tema claro/escuro**: botão 🌓 Tema na sidebar; a escolha fica salva no seu navegador.

**Responsáveis por função**: no cadastro do cliente, cada dropdown mostra apenas os colaboradores daquela função (definida em Configurações). Consultor tem a opção "NÃO TEM" para clientes sem consultor — sem gerar pendência.

**Acesso a partir do colaborador**: em Configurações, o botão 🔑 Criar acesso gera a conta do membro com login sugerido pelo primeiro nome (ex.: Juliana → juliana).

## Novidades da versão 3

**Faturamento por cliente**: nova tela pra lançar meta, faturamento real e ticket médio de cada cliente mês a mês, com gráficos, link direto por cliente e PDF individual. Acesso liberado pra Admin e Estrategista de Atendimento (só dos próprios clientes).

**Relatórios em PDF**: central com Relatório Mensal da Carteira, Relatório de Churn e Produtividade por Pessoa, todos exportáveis em um clique (só admin).

**Simplificação de status**: "Ativo OK" saiu de cena — agora é só "Ativo". Menos opção, menos confusão.

**Por Pessoa mais enxuto**: filtro por função, Consultor/Gerente fora da lista (é da equipe do cliente, não da agência) e clique na linha leva direto pro cadastro do cliente.

**Ordenação em Clientes**: alfabética, saída mais recente ou mais antiga primeiro.

**Modo mobile**: o sistema roda bem no celular, com menu em gaveta lateral.

**Olho de mostrar/ocultar senha**: nos campos de senha do login e das Configurações.

## Novidades da versão 4

**Serviços contratados**: os campos de Apoio, Consultor, Social Media e Edição de Vídeos ganharam a opção "NÃO TEM", além da já existente "EQUIPE PRÓPRIA" — assim dá pra registrar direito quando um serviço não é feito pela agência, sem gerar pendência à toa.

**Artes semanais**: novo campo no cadastro do cliente pra guardar quantas artes por semana o contrato inclui.

**Coluna Serviços em Clientes**: etiquetas rápidas mostrando o que a agência faz por cada cliente, direto na listagem.

# Pedido: MCP de escrita do Jira para o Portal Tech V&D

## Contexto
O Portal Tech V&D é o portal de ferramentas ágeis das squads de Varejo e Distribuição. Hoje ele **só lê** do Jira, e cada usuário informa o domínio e o seu token pessoal, que o navegador envia ao backend a cada chamada. Vários módulos passam a precisar **gravar** no Jira. Em vez de cada módulo falar com o Jira por conta própria, queremos **um único MCP do Jira, de leitura e de escrita,** que atenda o portal inteiro, com autenticação, limites, simulação e auditoria resolvidos num lugar só. Com ele, o token do Jira deixa de passar pelo navegador.

## Leitura e busca (já existe hoje, deve ser coberta pelo MCP)
| Tela ou módulo | O que lê do Jira |
|---|---|
| Squad: quadro, cronograma, métricas e painéis | Busca por JQL, sprint, quadro (greenhopper), worklog |
| Sincronização das squads e backlog do planejamento | Issues e subtarefas com tipo, status, estimativas, responsável, sprint, datas |
| Importação de pessoas, papéis e equipe (onboarding e administração) | Papéis do projeto, membros, líder, componentes, usuários |
| Scrum Poker | Importação de issues e fila de tópicos |
| Review | Issues e anexos (imagens) |
| Devtools | Caso de teste do Zephyr Scale (ATM) |
| Geral | Busca de campos (para achar os ids dos campos personalizados), dados do usuário logado, lista de quadros |

Precisamos de: busca por JQL com paginação e escolha de campos, detalhe de issue, subtarefas por pai em lote, sprints e quadros (API ágil), campos personalizados, papéis e membros do projeto, worklogs, anexos e o caso de teste do Zephyr. Hoje usamos o Jira Server/Data Center em `/rest/api/2`, `/rest/agile/1.0`, `/rest/greenhopper/1.0` e `/rest/atm/1.0`.

## Escrita: quem usa e para quê
Nenhum módulo grava no Jira hoje. A única gravação já decidida é a do planejamento da sprint; as demais são candidatas e dependem de decisão de produto.
| Módulo | O que precisa gravar | Situação |
|---|---|---|
| Planejamento da sprint | Responsável e sprint das subtarefas, datas planejadas de início e fim, meta da sprint (Sprint goal) | Decidido, em implementação |
| Scrum Poker | Estimativa na issue pai no formato "(DEV 10h / QA 4h)" no título; horas (estimativa original e restante) nas subtarefas de Codificação e Execução de TI; criação das subtarefas DEV e QA | Hoje é copiado à mão; automatizar é uma possibilidade |
| Review | Comentário e feedback na issue; eventualmente criação de issue a partir de um achado | A avaliar |
| Plano de ação | Criação de issues a partir das ações; vínculo com a issue de origem | A avaliar |
| Outros módulos | Novos casos entram sem refazer integração | Futuro |

## Operações necessárias
1. **Atribuir responsável** em issue ou subtarefa.
2. **Incluir issues e subtarefas numa sprint**, e **gravar a meta da sprint** (Sprint goal), pela API ágil.
3. **Gravar datas planejadas** (início e fim) em subtarefas: precisamos dos nomes ou ids dos campos personalizados e do formato aceito (data ou data e hora).
4. **Gravar estimativas**: estimativa original e tempo restante, em horas.
5. **Alterar o título** de uma issue.
6. **Criar subtarefa**: tipo (por id), título, estimativa, responsável e issue pai.
7. **Comentar** numa issue.
8. **Criar issue** com projeto, tipo, título, descrição e vínculo.
9. **Transicionar status**, apenas se um dia for necessário (opcional, desligado por padrão).
10. **Ler o estado atual** dos campos acima, para o portal mostrar "de → para" antes de gravar.

## Comportamento esperado
- **Lote com resultado por issue:** sucesso, ignorado (já estava igual) ou recusado, com o motivo. Uma falha numa issue não desfaz as outras.
- **Simulação (dry run):** valida e devolve o que mudaria, sem gravar.
- **Idempotência:** repetir o mesmo pedido não duplica nada (subtarefas, comentários, vínculos).
- **Limite de taxa do Jira Data Center:** resposta clara de "tente de novo em N segundos" e controle de fila no próprio MCP.
- **Auditoria:** cada gravação registra quem, quando, qual issue, valor anterior e valor novo. O portal também guarda a sua própria auditoria.
- **Erros legíveis em português ou com código estável**, para o portal traduzir (permissão negada, campo inexistente, issue já fechada, workflow que não permite).

## Segurança e autoria
- Hoje cada usuário informa o seu token pessoal do Jira e o navegador o envia ao backend. Queremos que o MCP guarde e use as credenciais (token de cada pessoa ou conta de serviço), para o token **nunca mais passar pelo navegador**. Precisamos saber como o MCP identifica o usuário (SSO do portal, token delegado, etc.).
- Definir se a gravação sai em **nome de quem enviou** (token individual de cada pessoa) ou de uma **conta de serviço**. Isso decide o autor que aparece no histórico do Jira e quem precisa de permissão em cada projeto. Preferência do portal: em nome de quem enviou, com a conta de serviço como alternativa.
- **Permissões mínimas:** só os campos e operações acima, só nos projetos das squads. Sem apagar issues.
- Autenticação do backend do portal para o MCP (token de serviço ou OAuth), com rotação.
- Segredos nunca no navegador: o MCP é chamado só pelo backend do portal.

## Ambiente
- Começar por um projeto ou instância de **homologação** do Jira, antes de produção.
- Informar: endereço do MCP, forma de conexão (HTTP, SSE ou outra), documentação das chamadas, limites e ambiente de teste.

## O que o portal faz do seu lado
- Um **gateway único de escrita** no backend que fala com o MCP; cada módulo (planejador, Poker, Review, Plano de ação) usa o mesmo gateway.
- Prévia "de → para" antes de qualquer gravação, e botão de envio travado enquanto houver pendência.
- Tratamento de erro parcial por issue na tela e auditoria própria.

## Perguntas que precisamos que vocês respondam
1. Qual o endereço, a forma de conexão e a documentação do MCP?
2. A autoria da gravação é do usuário ou de uma conta de serviço?
3. Quais campos personalizados guardam início e fim planejados (nomes e ids) e em que formato?
4. Existe projeto ou instância de homologação para testarmos?
5. Há limite de taxa ou janela de manutenção que precisamos respeitar?

# Decisões pendentes e riscos aceitos

Reunião, em 2026-10-09, do que as auditorias dos módulos deixaram **sem corrigir porque depende de uma decisão de produto ou muda contrato**. Cada item aponta para o documento do módulo, onde está o detalhe. Marque aqui o que for decidido e remova o item (a decisão passa para o documento do módulo).

## Já decidido (registrado)

| Decisão | Valor |
|---|---|
| Quem cadastra equipes | Só Agile Master, People Lead e admin; ninguém ganha papel por criar ou importar (o Jira diz) |
| Acesso à Review | A Review é da squad, mas **quem recebe o link acessa**; sem trava por squad |
| Biblioteca de IA sem login | Só para itens **públicos** (`/api/public/prompt-hub`); coleções e escrita exigem login |
| Novidades em salas e cerimônias | Opt-in do facilitador; o comportamento padrão não muda |
| Cadastro | **Autocadastro aberto**, só para e-mails `@totvs.com.br` e `@ext.totvs.com.br` (correspondência exata do domínio). Sem verificação de e-mail: risco aceito pelo produto. `APP_REGISTRATION_ENABLED=false` fecha o cadastro se for preciso (padrão `true`) |

## Segurança e acesso (`seguranca-transversal.md`, `autenticacao-e-sessao.md`)

2. **Chaves de API sem expiração e com papel congelado na criação** (as legadas e as do painel têm acesso total). Revogar e recriar quebra integrações.
3. **Admin lê os tokens de Jira e TDN de qualquer pessoa.** Os tokens ficam em texto claro no `localStorage` do navegador e continuam lá depois do logout.
4. **`SquadAccessService` casa o nome da conta (editável) com o nome do membro da squad** para dar acesso à squad.
5. **Sem logout nem refresh no servidor:** o token vale 24 h; a única revogação é desativar a conta. Token do WebSocket na query string (cinco endpoints).
6. **Rate limit em memória e por IP**, sem limite em `/mcp` e `/ws`. O Caddy não roteia `/mcp/*`: confirmar se o MCP está acessível em produção.
8. **Chave de IA do usuário volta decifrada do servidor ao navegador** (`base-de-conhecimento.md`). A correção real é o Spring chamar o provedor (mudança de arquitetura).
9. **Variável de build `NEXT_PUBLIC_GEMINI_API_KEY`:** conferir no `.env` da VM que está vazia.

## Retro (`retro.md`)

10. **Anonimato é só visual:** o servidor envia texto e autor de cards não revelados. Mascarar até a revelação muda o contrato do tempo real.
11. **Expulsão não é permanente** (não há lista de banidos).
12. **Timer usa o relógio de cada navegador**; falta um relógio do servidor.

## Poker (`poker.md`)

13. Leitura de sala, participantes, votos e rodadas aberta a qualquer autenticado, e WebSocket sem checar membro: fechar exige mudar o fluxo de entrada. **Confirmado ao vivo:** quem não está na sala não grava nem limpa nada, mas quem entra como participante (o link basta) consegue revelar e limpar os votos pela API.
14. Exigir facilitador para revelar ou limpar: o facilitador de reserva é decidido no cliente.
15. Pontos do Jira: a busca por `customfield_*` não funciona; precisa de `expand=names` ou de um id configurável por squad.

## Review (`review.md`)

16. Fallback fixo `DDWMISSI` ao criar Review sem squad.
17. N+1 na listagem do hub; arquivos órfãos quando a sessão é apagada; token do WebSocket na query.

## Biblioteca de IA (`biblioteca-ia.md`)

18. **Fuso das datas (conferido em produção):** VM, contêiner do backend e Postgres estão em **UTC**; o servidor envia `LocalDateTime` sem fuso e o navegador os lê como horário de Brasília, adiantando 3 h. Opções: (a) o servidor passa a enviar instante com `Z`/offset (serializar `LocalDateTime` como UTC, sem mudar o banco; o frontend já converte para o local); (b) colocar a JVM em `America/Sao_Paulo` (mexe nas linhas novas, as antigas ficariam 3 h desencontradas). Recomendado: (a). Afeta 59 classes; precisa de decisão e de teste ao vivo.
19. **Seed restrito a admin só na tela**, não no servidor.

## Brainstorming, Health Check, Plano de Ação (`brainstorming.md`, `health-check.md`, `plano-de-acao.md`)

20. O acesso por link vale para os três e não há checagem de squad, porque o mural e o radar só guardam o **nome** da squad em texto livre. Restringir exige guardar o `squadId`.
21. Facilitador do Brainstorming deve poder **apagar ideia de outra pessoa pela tela**? O servidor já permite.
22. Quem entra pelo link deve entrar em `participantIds`? Hoje o histórico do Meu Espaço só mostra o que a pessoa criou.
23. Encerrar o Health Check com **baixa participação** deve avisar o organizador? E o anonimato real: a tabela guarda o id do votante.
24. Limite de votos no Brainstorming nunca existiu (os textos prometiam 5): se quiserem, deve ser opt-in do facilitador.

## Observações do teste ao vivo (2026-10-09)

50. Várias telas repetem as mesmas leituras ao abrir (a Retro busca quadro, cards e participantes 5 vezes seguidas): não quebra nada, mas pesa; vale deduplicar.

## Painel, Governança, Jira (`painel.md`, `governanca-e-projetos.md`, `integracao-jira.md`, `jira-dash.md`)

25. **Proxy `/jira` do Jira Dash funciona sem login do Portal** (o iframe só conhece o token do Jira). Exigir login muda o desenho.
27. **Snapshot compartilhado do Jira Dash é gravável por qualquer logado** (dá para envenenar o cache de uma consulta).
28. **TLS tolerante como segundo caminho:** o ideal é instalar a CA corporativa no contêiner e desligar o fallback.
29. **Gate do dashboard do PO só na interface:** o servidor devolve os mesmos dados a qualquer membro da squad.

## Workspace, Conhecimento, Manual (`workspace.md`, `base-de-conhecimento.md`, `manual-e-ajuda.md`)

31. **Qualquer pessoa edita qualquer documento da Base**, sem versões: abre caminho para adulterar o que o Assistente lê. Versionamento ou aprovação é decisão de produto.
32. **Kanban sem ordem manual** dentro da coluna (precisa de coluna de posição e migration).
33. A busca da Base carrega todos os documentos na memória; para milhares precisa de busca vetorial no banco.
34. OpenAI e Anthropic aparecem como "Em breve"; hoje só Gemini funciona.

## Jolt e DevTools (`jolt.md`, `devtools.md`)

35. **`POST /api/jolt/transform` continua sem login** (execução pública, mitigada por limites, 10 s e 300 req/min por IP). Exigir login muda o contrato de quem chama de fora.
36. **Cliente HTTP do DevTools:** o CSP só libera alguns destinos. Manter, liberar hosts específicos ou abrir `https:` inteiro (enfraquece a proteção contra XSS)?
37. Expor na tela o compartilhamento de projeto Jolt (o servidor já suporta público e squad).
38. O hub do DevTools promete que o conteúdo não sai da máquina, mas CEP, IP, Zephyr e o Gerador JUnit avançado enviam dados a terceiros; o PAT do Jira e a chave do Gemini ficam em texto puro no `localStorage`.
39. `/api/mock-config` guarda mocks na memória do servidor (compartilhados e perdidos no deploy) e a tela não os usa: remover ou dar dono e persistência.
40. O **Planejador** (`/sprint-planner`) mostra "Em breve"; o componente de Arquitetura (Excalidraw) e `/agile-tools` não têm funcionalidade.

## Squad, dashboards, planejamento (`squad.md`, `dashboards-por-papel.md`, `sincronizacao-jira-squad.md`, `planejamento-sprint.md`)

41. **Casamento por nome dá acesso à squad:** um homônimo de alguém do roster ganha leitura. Remover pode travar quem depende disso hoje; o ideal seria só "Sou eu" ou convite.
42. **Painéis JQL ficam só no navegador:** a opção "Toda a Squad" não compartilha nada (a tela avisa). Ligar ao backend, que já existe, é feature nova.
43. **Duas capacidades que não conversam** (horas/dia da pessoa x papel/dias/horas produtivas por sprint); as horas por pessoa somam o worklog inteiro da issue, não só a janela da sprint.
44. **Planejador de sprint:** `/sprint-planner` é "Em breve" e o backend existe sem tela. Portar ou redesenhar?
45. **Decisão do PO na Review:** o servidor não checa papel; qualquer membro da squad grava.
46. **Sincronização:** sprint futura sem datas cai em `UNMAPPED`; o roster nunca remove quem saiu do Jira; teto de 2000 issues; impedimentos e prioridade não sincronizam. **Ligar o agendador de sync em produção é decisão sua.**
47. **Pessoas do time (AM/PL):** só o admin atribui Agile Master/Scrum Master/People Lead (esses papéis dão o poder de cadastrar equipes) e só o admin altera ou remove quem os tem (exceto a própria pessoa). Se quiser que um PL promova outro AM/PL da própria equipe, é decisão sua. Tribe Lead e Agile Coach seguem só vindo do Jira.

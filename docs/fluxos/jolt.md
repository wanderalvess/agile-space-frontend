# Jolt (Sandbox e Gerador de spec)

## Objetivo e quem usa

Ferramenta para **transformar um JSON em outro** usando uma especificação Jolt (a "spec"). Serve a quem monta e mantém os layouts de integração (TOTVS SmartHub / PDVSync): ou escreve a spec à mão (Sandbox), ou dá um exemplo e a spec é gerada (Gerador).

- Qualquer pessoa **logada** usa tudo. Não há papel específico.
- **Visitante** (sem login) abre `/jolt`, `/jolt/sandbox` e `/jolt/gerador` (rotas abertas no `AuthGuard`): lê o Hub e a folha "Como funciona" e pode editar entrada e spec. **Executar, Salvar e Gerar** abrem o diálogo "Entre para executar" (o servidor exige login para executar e gerar). O rascunho de visitante fica na chave `visitante` e passa para a conta ao entrar.

## Telas

| Tela | Caminho | O que é |
|---|---|---|
| Hub | `/jolt` | Os dois modos (Sandbox e Gerador), "Seus layouts recentes" (até 4, do navegador) e a folha "Como funciona" |
| Sandbox | `/jolt/sandbox` | Três editores (Entrada, Spec, Saída), layouts salvos, GitHub, Modelos, Manutenção, Layout completo |
| Gerador de spec | `/jolt/gerador` | Entrada + saída esperada → regras → spec conferida no servidor |

Todas têm a barra do módulo (Início, Sandbox, Gerador, atalho para o JSON Studio) e a folha **Como funciona** (`JoltHowItWorks`, sobre o `GuideSheet` do kit): fluxo de 4 passos, as 6 operações (shift, modify, default, cardinality, remove, sort), atalhos reais e a nota "Seus dados saem do navegador: a execução acontece no servidor".

### Sandbox

- **Execução**: sempre no servidor (biblioteca oficial Bazaarvoice, em Java). Só existe um jeito de executar; a tela mostra o tempo da execução no selo da Saída. Um clique por vez (botão travado enquanto executa) e a resposta de uma execução abandonada ("Limpar", troca de layout, layout do GitHub) é descartada.
- **Atalhos reais**: `Ctrl+Enter` executa e `Ctrl+S` salva o layout (também `Cmd` no Mac), valem na página e dentro do Monaco; o `Ctrl+S` não abre o "Salvar página" do navegador. Ficam quietos com uma janela aberta por cima. Os atalhos aparecem nos botões.
- **Salvar** é imediato (sem espera fingida) e mostra "Salvo agora"; "Alterações não salvas" volta assim que algo muda. Sem nome, não grava. Se a cota do navegador estourar, avisa com o motivo.
- **Layouts salvos**: `localStorage`, por usuário (`agileSpace_jolt_layouts_{id}`). Não vão ao servidor. Trocar de layout com alterações não salvas pede confirmação; excluir também.
- **Modelos** (shift, modify, default, cardinality, remove): **substituem a spec**. Com a spec preenchida há confirmação ("Cancelar", "Salvar antes", "Substituir a spec"); com a spec vazia entram direto.
- **Barra do GitHub** (Integração → Rota → Versão → Carregar layout): **só sob demanda**. Abrir a página não faz nenhuma chamada; o botão "Buscar layouts do GitHub" consulta versões e árvore. Estados: ainda não consultado, buscando, limite atingido (com o horário, se o GitHub informar), erro, árvore cortada, rota ausente na versão e carregado. A rota escolhida só vira "carregada" depois que o arquivo chega. Repositório padrão `totvs/winthor-smart-hub-layouts`; "Trocar" valida o nome e consulta antes de usar. Sem token do GitHub (cerca de 60 consultas por hora por rede).
- **Manutenção** (folha lateral): acrescenta, troca ou remove só ligações do `shift`; o resto da spec volta exatamente como entrou. Campos da entrada que a spec não usa, mapeamentos com filtro, edição por linha (`Esc` cancela só a edição, não fecha a folha), remoção com confirmação e "Desfazer a última".
- **Layout completo**: copiar ou baixar o arquivo inteiro (`tabela.campos`) com a spec editada.
- **Rascunho**: entrada, spec, nome, URL e última saída sobrevivem ao recarregar (`agileSpace_jolt_rascunho_sandbox_{id}`). Se não couber, abre mão primeiro do layout completo e da saída; se nada couber, avisa uma vez.
- **Abrir no Gerador** leva a entrada (`jolt_sandbox_para_gerador`).

### Gerador de spec

A pessoa entrega um **exemplo**: a resposta da API de origem e a saída que a de destino espera. O backend (`POST /api/jolt/generate`, exige login, até 50 mil campos por JSON) descobre de onde vem cada campo, monta a spec e **prova** o resultado rodando-a no Java e comparando com a saída esperada.

1. **Exemplos**: dois editores com validação de JSON (linha e coluna), "Colar", "Formatar" e "Usar exemplo". As entradas são rascunho (`agileSpace_jolt_rascunho_gerador_{id}`).
2. **Regras**: uma linha por campo da saída (de onde vem, a regra, o valor de exemplo). **A confirmar** (âmbar, no topo) traz o que o exemplo não prova sozinho. Cada ajuste é guardado ("Guardar ajuste") e só vai ao servidor em **Aplicar ajustes**; **Gerar spec** só libera sem pendências e sem ajustes por aplicar. A barra de contagens fica na base da coluna de conteúdo (`sticky`), respeitando largura e navegação.
3. **Spec e validação**: diz se a saída gerada bate (ou a tabela de diferenças com "como resolver"), resume os passos da spec e mostra a spec (`LAYOUTTRANSFORMACAO`) ou o **registro completo da rota** (`PCINTEGRACAOROTASERVICO`) com o formulário "Rota de integração" (serviço, empresa, tipo, requisição, cabeçalhos, parâmetros, 4 opções, variáveis). **Carregar registro** preenche o formulário com um arquivo de rota existente. **Abrir na Sandbox** deixa a spec (ou o registro) e a entrada em `jolt_gerador_para_sandbox`; se a cota estourar, avisa e não navega.

**Dois modos de leitura, decididos pelo servidor** (`JoltSpecGenerator.Mode`; não há escolha na tela):
- **Valores**: a saída traz os valores do mesmo registro da entrada; cada origem é achada procurando o valor na entrada.
- **Contrato**: a saída é o exemplo do contrato do destino, com valores genéricos (`"string"`, `0`, `true`); as origens vêm pelo nome do campo e as regras pelo tipo, e a conferência vê campos e tipos, não valores. É contrato quando a maioria dos textos da saída é genérica.

A resposta traz `validation { ran, matches, error, differences, checkedFields }`. `ran === false` aparece como "A spec foi gerada, mas não foi conferida" (nunca como "bate"). Como a inferência decide: a regra tem que valer para **todos** os itens das listas alinhadas; listas da saída são ligadas à lista da entrada de mesmo tamanho que mais explica os campos; concatenação acha os pedaços na entrada, inclusive em campos do item pai; valor comum só vira cópia se o nome do campo também bate. Casos reais de teste: `agile-space-backend/src/test/resources/jolt-generator/`.

## Execução no servidor (motor Java)

`POST /api/jolt/transform` **exige login** (desde 2026-10; antes era público). Anônimo recebe `401`; o `joltService` usa `authFetch`, então o frontend antigo já mandava o token e o backend pode subir antes do frontend. `GET /api/jolt/engine-info` também exige login (a tela não usa).

Limites (corrigidos em 2026-10-09, antes não havia nenhum):

| Limite | Valor |
|---|---|
| Corpo da requisição | 5 MB (filtro `JoltRequestSizeFilter`, vale também para corpo "chunked"); acima disso `413` |
| Texto de entrada / de spec | 2 milhões de caracteres cada |
| Elementos | entrada 200 mil; spec 20 mil |
| Profundidade de aninhamento | 64 níveis |
| Operações na spec | 50 |
| Tempo | 10 s por transformação, em pool de 2 a 4 threads com fila de 8 (excesso responde "O servidor está ocupado com outras transformações") |
| Taxa | 300 requisições/min por IP (filtro geral `/api/**`). Não há limite por usuário (o mecanismo de taxa é só por IP) |

Erros devolvidos ao cliente: erro de spec do Jolt e entrada inválida voltam como mensagem de uma linha (até 400 caracteres, sem trecho de código nem stack); qualquer falha inesperada volta como mensagem genérica e o detalhe vai só para o log. A resposta sempre tem `success`, `output`, `error`, `executionTimeMs`, `engine`.

### O que o Java executa (e por que o motor JavaScript saiu)

Operações aceitas pelo Chainr: `shift`, `default`, `remove`, `sort`, `cardinality`, `modify-overwrite-beta`, `modify-default-beta`. `custom-decode` e `custom-totvs` não existem no Jolt: o servidor decodifica Base64 nos campos marcados com `=base64ToObject` (JSON vira objeto, texto fica texto) **antes** do Chainr e tira a operação da spec; testado com `data → * → conteudo`.

Até 2026-10 existia também um motor local em JavaScript (`jolt-lite`) e um modo "Comparar". Ele saiu: o comportamento do Java foi conferido contra 44 casos (shift com curingas, `#`, `$`, `@`, `&`; default; remove; cardinality; sort; modify com as funções oficiais; `custom-decode`; o layout real de clientes do PDVSync) e os dois motores concordaram em 34. As 10 diferenças eram o JavaScript aceitando coisas que o Jolt oficial **não** faz e que, portanto, nunca funcionariam na produção:

| Caso | Java (oficial) | JavaScript (removido) |
|---|---|---|
| `=replace`, `=multiply`, `=padLeft`, `=padRight` | função inexistente: nada acontece | executava |
| `=toBoolean` de `"sim"`, `"1"`, `1` | mantém o valor | virava `true` |
| `=base64ToObject(...)` dentro do `modify` | só vale via `custom-decode` | decodificava |
| função desconhecida (`=naoExiste`) | campo fica como estava | gravava o texto `"=naoExiste"` |
| `modify-define-beta` (operação desconhecida sozinha na spec) | erro "spec vazia" | ignorava |
| `toString` de `null` | `null` | `""` |
| `shift` que não casa nada | `null` | `{}` |
| número inteiro como decimal (`1.0`, `1e3`) | `1.0`, `1000.0` | `1`, `1000` |

Quem escrevia `=replace`/`=multiply` e via funcionar na prévia local, na verdade tinha uma spec que a produção não executa. Operações desconhecidas no meio de uma spec maior continuam sendo **descartadas em silêncio** pelo servidor (ver "Pontos frágeis").

## Permissões

- `/api/jolt/transform`, `/engine-info` e `/generate`: qualquer pessoa logada.
- **Projetos salvos no servidor** (`/api/jolt/projects`, com versões e permissões): continuam no backend para uma fase futura, mas **nenhuma tela os usa** (o código de cliente foi removido). O que valia: listar só o que a pessoa pode ler (criou, é público ou é da mesma squad; ADMIN lê tudo); criar para qualquer logado; alterar/excluir/restaurar só o autor ou ADMIN (`403`); `expectedVersion` diferente da atual dá `409`.

## Dados guardados (negócio)

No navegador, nada vai ao servidor:

| Chave | O que guarda |
|---|---|
| `agileSpace_jolt_layouts_{id}` | layouts salvos da pessoa (nome, URL de origem, spec, última entrada) |
| `agileSpace_jolt_rascunho_sandbox_{id}` | entrada, spec, nome, URL, última saída e (se couber) o layout completo |
| `agileSpace_jolt_rascunho_gerador_{id}` | as duas entradas do Gerador |
| `jolt_gerador_para_sandbox` | spec (ou registro) e entrada deixadas pelo Gerador; lida e apagada pela Sandbox |
| `jolt_sandbox_para_gerador` | entrada deixada pela Sandbox; lida pelo Gerador e apagada logo depois |
| `github_layouts_tags_*`, `github_tree_*` (sessionStorage) | cache das consultas ao GitHub |

`{id}` é o id da conta; sem login vale `visitante`. As chaves antigas `jolt_visual_*` e `jolt_generator_input` ainda são aceitas na leitura (quem estava no meio do fluxo no deploy) e nunca mais são escritas. Toda escrita passa por `src/lib/jolt-storage.ts` (try/catch, limite de tamanho, resultado `grande`/`cheio`/`indisponivel` que a tela transforma em aviso).

## Pontos frágeis e erros de fluxo conhecidos

- **Operações desconhecidas são descartadas em silêncio no Java** quando há outras operações válidas na spec (ex.: um `modify-define-beta` no meio). Nada avisa na execução.
- **`smartHubEnvelope` e `sortKeys`** deixaram de ser enviados; o servidor sempre os ignorou.
- **Gerador usa só o nome da folha** do campo de origem (`cliente.nome` vira `nome` sob `items.*`): campos aninhados ou duas origens com o mesmo nome de folha colidem (a última vence). Também deduz entidade e faz conversões por nome (`situacao`, `prioritaria`, datas, ids), regras do PDVSync.
- **Listas de objetos: só o primeiro item** é considerado em alguns casos; campos que só existem em outros itens podem não aparecer.
- **Layouts e rascunhos ficam no navegador**: em máquina compartilhada, quem usa a mesma conta vê os mesmos. Por usuário, mas não criptografado. `localStorage` tem ~5 MB; a tela avisa quando não cabe.
- **O Monaco vem do CDN** (`cdn.jsdelivr.net`, configurado em `components/layout/MonacoConfig.tsx`, versão 0.52.0). Servir localmente exigiria declarar `monaco-editor` como dependência e copiar `min/vs` para `public/` (ou configurar o webpack), o que não foi feito. O editor segue os tokens do tema (tema `portal-jolt`) e usa fonte de 13 px.
- **GitHub sem token**: limite baixo; sem cache entre sessões além do `sessionStorage`.
- **Sem limite por usuário** na execução (só por IP). Um escritório atrás do mesmo IP divide os 300 req/min.
- **CORS dos controllers é `*` com credenciais.** A autenticação é por `Authorization: Bearer` (não cookie), então o risco prático é baixo; vale revisar junto com a política geral.
- **Quem chamava `/api/jolt/transform` de fora do portal sem token** passa a receber `401`.

## Onde olhar no código

- Frontend: `src/app/jolt/` (`page.tsx` hub, `sandbox/page.tsx`, `gerador/page.tsx`), `src/components/jolt/` (`JsonEditor`, `GithubIntegrationBar`, `useGithubLayouts`, `LayoutCard`, `JoltMaintenancePanel`, `GeradorRules`, `RouteRecordPanel`, `JoltHowItWorks`, `JoltBits`, `JoltNav`, `useJoltShortcuts`), `src/lib/` (`jolt-storage`, `jolt-json`, `jolt-shortcuts`, `jolt-sandbox`, `jolt-editor-theme`, `jolt-generator`, `jolt-generator-example`, `jolt-maintenance`, `jolt-route-record`) e `src/services/joltService.ts` (só a execução).
- Backend: `JoltExecutionController`, `JoltJavaEngineService` (limites e execução), `JoltRequestSizeFilter`, `JwtAuthenticationFilter` (lista de rotas públicas, sem o Jolt), `JoltGeneratorController`, `JoltSpecGenerator*`, `JoltProjectController` (sem uso na tela). O caminho `/api/jolt/**` vai ao Spring no Caddy (não está na lista `@nextApi`).
- Testes: frontend `src/lib/__tests__/jolt-*.test.ts`, `src/components/jolt/__tests__/`, `src/app/jolt/__tests__/` (telas, atalhos, GitHub, rascunho, regras visuais); backend `JoltJavaEngineServiceTest` (inclui o layout real de clientes em `src/test/resources/jolt-engine/clientes`) e `JwtAuthenticationFilterPublicPathTest`.

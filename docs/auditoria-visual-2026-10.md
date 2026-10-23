# Auditoria visual do Portal Tech V&D (homologação) - 2026-10-18

Alvo: https://app.espacoagil.com.br (versão no rodapé v4.24.0), logado como admin "Wanderson". Somente leitura; nada foi criado ou alterado.

## Método e limites

- 81 rotas navegáveis (as 95 `page.tsx` menos as dinâmicas sem id real) abertas em iframe same-origin (sandbox) a 1440 px e a 375 px. Por rota: `header`/`footer`/`#conteudo` (marcadores do PageShell), overflow horizontal da página, alvos < 24 px, texto com degradê (`background-clip:text`), termos em inglês, "engenharia" na copy.
- Contraste de texto (razão < 3:1) em 3 combinações em todas as 81 rotas: Leitura escuro, Padrão claro, Leitura claro. O tema original (Padrão, escuro, sem chaves `theme`/`theme-variant` no localStorage) foi restaurado e o viewport voltou a desktop.
- Capturas de tela só em amostra: /manual, /jolt/sandbox, /knowledge/kb, /devtools/json, /squad (Leitura escuro; mobile e desktop). Os demais vereditos vêm de DOM + varredura de classes legadas no código (`slate-*`, `bg-white`, `text-[8px]`).
- Os 7 temas não foram percorridos um a um: só Padrão e Leitura (claro/escuro). Midnight, Nebula, Cyberpunk, Nordic e TOTVS: NÃO VISTO.
- Console: o buffer do navegador só guarda os últimos eventos e não separa por rota. Só apareceram 6 "Failed to load resource 404" repetidos, que não reaparecem em `performance.getEntriesByType('resource')` de /room, ou seja, não atribuíveis a uma rota. Console por rota: NÃO VERIFICADO de forma confiável.
- Animação de entrada: com o painel do navegador oculto, `animate-in fade-in` pode ficar parado em opacity 0 (vi isso em /knowledge/kb e a hero de /manual esmaecida). Pode ser artefato do painel oculto; vale rever com a janela visível (ver D3).

## Veredito por rota

Critério: NOVO = PageShell (AppHeader + #conteudo + AppFooter) e componentes do kit/tokens; MISTO = shell novo, mas miolo com classes legadas (slate/white/8px uppercase black); ANTIGO = sem shell e visual antigo; NÃO VISTO = precisa de id/sessão real ou é redirecionamento.

| Rota | Veredito | Nota |
|---|---|---|
| / (Hub) | NOVO | shell completo |
| /admin | NOVO | |
| /squad | NOVO | abas e KPIs ok; 375 px ok |
| /squad/roster | NOVO | |
| /squad/dashboards, /agile-master, /custom, /member, /people-lead, /product-owner, /tech-lead, /tribe-level | NÃO VISTO (redireciona) | todas caem em /squad (aba do hub); o conteúdo vive nos componentes de squad, ver D5 |
| /squad/panels | NÃO VISTO (redireciona) | idem |
| /workspace | NOVO | 375 px: 4 alvos pequenos |
| /changelog | NOVO | 79 mil caracteres numa página; "engenharia" não aparece como rótulo |
| /configuracoes | NOVO | |
| /support | NOVO | Leitura escuro: botão "Enviar Solicitação" 1.9:1 |
| /governance | NOVO/MISTO | Leitura escuro "Abrir Suporte" 1.8:1; Leitura claro "Estamos aqui para ajudar." 2.7:1; tabela com min-width rola em 375 px |
| /governance/product-owner | NÃO VISTO (redireciona) | vai para /squad |
| /manual | MISTO | shell novo; miolo legado (hero "O SEU GUIA DE ALTA PERFORMANCE", itálico uppercase black, 128 usos de slate/white nos arquivos); contraste < 3:1 em 14 a 16 textos (Padrão e Leitura claro) e 1 no Leitura escuro |
| /manual/{topic} (ex.: /manual/poker) | NÃO VISTO ao vivo | avaliado só pelo código (conteúdo em app/manual/content/*Topic.tsx, legado) |
| /knowledge (-> /knowledge/chat/{id}) | NOVO/MISTO | redireciona para o último chat |
| /knowledge/chat, /knowledge/chat/{id} | MISTO | AppHeader + sub-barra; 131 classes legadas em components/knowledge |
| /knowledge/kb | MISTO | ver D3 (opacity 0 e título de aba padrão) e corte de botões em 375 px |
| /knowledge/admin | MISTO | redireciona para /knowledge/kb |
| /knowledge/admin/new-asset | MISTO | |
| /knowledge/manual | MISTO | Padrão e Leitura claro: 4 textos `text-[8px]` uppercase com 2.3:1 a 2.5:1 |
| /knowledge/settings | MISTO | 4 alvos pequenos |
| /knowledge/trash | MISTO | |
| /jolt | NOVO | |
| /jolt/gerador | NOVO | |
| /jolt/sandbox | MISTO | shell novo; barra do GitHub com `slate-*`, `bg-white`, texto 8px black uppercase (components/jolt/GithubIntegrationBar.tsx); 4 alvos < 24 px |
| /devtools | NOVO | |
| /devtools/* (35 ferramentas: api-client, api-diff, api-snippets, automation, base64, bdd-bugs, calculators, cep, cert-inspector, cron-decoder, date-time, deep-decoder, diff, doc-generator, fuzz, ip-analyzer, json, json-schema, junit-generator, jwt-inspector, markdown-viewer, mocks, regex-lab, secret-vault, sql-formatter, string-master, test-data, type-generator, url-encoder, uuid-generator, xlsx-to-csv, xml, yaml-converter, zephyr) | NOVO | todas com shell, 0 classes legadas em app/devtools, sem estouro horizontal a 375 px (overflows só dentro de editor Monaco ou barras rolantes); /devtools/mocks tem a palavra "Error" no texto (conferir se é rótulo em inglês); /devtools/json 3 alvos pequenos |
| /prompt-hub | NOVO | biblioteca vazia (0 itens) em homologação |
| /prompt-hub/colecoes | NOVO | |
| /prompt-hub/tutorial | MISTO | 13 alvos < 24 px; texto "Upload"; tabela min-w 520 px rola em 375 px |
| /prompt-hub/seed | ANTIGO | sem AppHeader/Footer/#conteudo; página de carga de dados (4 modelos de exemplo), ver D4 |
| /prompt-hub/{id}, /prompt-hub/autor/{id}, /prompt-hub/colecoes/{id} | NÃO VISTO | biblioteca vazia, sem ids reais. Pelo código autor e coleções usam PageShell; /prompt-hub/{id} não cita PageShell no arquivo da página |
| /qa | NOVO | |
| /health-check | NOVO | hub (ToolHubLayout) |
| /action-plan | NOVO | hub |
| /brainstorming | NOVO | hub |
| /retro | NOVO | hub com 4 retros reais |
| /room | NOVO | lista com 9 sessões |
| /showcase | NOVO | hub |
| /showcase/{id} | NÃO VISTO ao vivo | há ids reais, mas abrir sala registra presença; pelo código usa room-kit. components/showcase tem 118 usos de slate/white (ver D2) |
| /room/{id}, /retro/{id}, /brainstorming/{id}, /health-check/{id}, /action-plan/{id} | NÃO VISTO | entrar numa sala cria participante (altera dados). Pelo código: room-kit em /room, /retro, /showcase; /action-plan/{id} com PageShell; /brainstorming/{id} e /health-check/{id} sem menção direta ao shell no arquivo da página (podem delegar a componentes) |
| /sprint-planner e /agile-tools/sprint-planner (redireciona) | ANTIGO | "Em breve" sem AppHeader/AppFooter nem #conteudo; ver D1 |
| /invite/{token inválido} | NOVO (estado de erro visto) | com token inválido a página mostra AppHeader/AppFooter (272 caracteres de corpo, sem estouro em 375 px); o fluxo de aceite NÃO foi visto ao vivo (não aceitar convite) |
| /onboarding | NÃO VISTO ao vivo | a conta admin é redirecionada para /. Pelo código: PageShell wide com `squadControl={null}`, OnboardingFlow (19 arquivos, 0 classes legadas) |
| /login, /reset-password | NÃO VISTO | exigem estar deslogado (não deslogar, não digitar senha). Pelo código têm tela própria sem shell, por design |
| /spotify-callback | NÃO VISTO | só faz `router.replace('/workspace')` |

## Defeitos priorizados

D1 - Alta. /sprint-planner ("Planejador de Entregas", Em breve) fica fora do shell novo.
- Passos: abrir /sprint-planner ou /agile-tools/sprint-planner. Sem cabeçalho, sem rodapé, sem navegação além do botão "Voltar ao Hub".
- Contraste: no Leitura escuro o botão "Voltar ao Hub" mede 1.0:1 (texto invisível).
- Causa: `ComingSoon` usa `<main>` próprio, `bg-[#fafafa] dark:bg-slate-950`, `text-slate-*`, `rounded-[2.5rem]`, texto 9px black uppercase.
- Arquivos: src/components/shared/ComingSoon.tsx, src/app/sprint-planner/page.tsx, src/app/agile-tools/sprint-planner/page.tsx.

D2 - Alta. Módulos inteiros com miolo legado dentro do shell novo: Manual, Base de conhecimento, Showcase (Review), Squad (modais/boards), Jolt Sandbox.
- Evidência de código (usos de `slate-*`/`bg-white`/`text-white`): components/squad 275, knowledge 131, showcase 118, app/manual 128, components/manual 98, jolt 47, workspace 13, prompt-hub (app) 14. Não seguem tokens, quebram nos temas (ver D6) e vão contra o guia de marca. Os gradientes de texto não aparecem (0 elementos com `background-clip:text` em todas as rotas).
- Visual: /manual com hero em itálico/uppercase/black; /jolt/sandbox com barra de GitHub em 8px.
- Arquivos: app/manual/components/ManualHero.tsx, ManualGuide.tsx, ManualSidebar.tsx; components/manual/IntegrationsSection.tsx; components/jolt/GithubIntegrationBar.tsx; components/knowledge/*; components/squad/{BoardConfigModal,SquadScrumBoard,SquadPerformanceView,SquadPlansTimeline,SquadWorkflowPhasesDialog,SquadDataState}.tsx; components/showcase/*.

D3 - Média (confirmar). /knowledge/kb fica com o conteúdo invisível e título de aba padrão.
- Passos: abrir /knowledge/kb em 375 px (e em 1440 px) e esperar 8 s. O contêiner `pt-6 pb-32 space-y-6 animate-in fade-in slide-in-from-bottom-4` fica com opacity 0 (visto também em tela cheia como esmaecido). A aba continua "Portal Tech V&D | Hub de Varejo e Distribuição" em /knowledge/kb e /manual, sem o padrão `"{título} | Portal Tech V&D"` do PageShell.
- Ressalva: o painel do navegador estava oculto, o que pausa animações CSS. Revalidar com a janela visível.
- Arquivos: src/app/knowledge/kb/page.tsx, src/app/knowledge/layout.tsx.

D4 - Média. /prompt-hub/seed (carga de dados) acessível a quem abrir a URL e sem shell.
- Passos: abrir /prompt-hub/seed como admin; a página oferece gravar 4 modelos públicos. Não cliquei. Confirmar que o botão não aparece em produção e que a rota é só admin; some do fluxo de uso.
- Arquivo: src/app/prompt-hub/seed/page.tsx (conteúdo em inglês misturado: "Refactor de Story Mapping", autor "Engenheiro", dados fictícios).

D5 - Média. Rotas de dashboards por papel redirecionam todas para /squad.
- Passos: abrir /squad/dashboards/tech-lead, /people-lead, /tribe-level etc., /squad/panels e /governance/product-owner. Todas caem em /squad (aba). Se isso é o desenho pós-redesign, remover as `page.tsx` mortas ou manter só o redirect; se não é, o conteúdo ficou inalcançável por URL direta (não dá para linkar um painel específico).
- Arquivos: src/app/squad/dashboards/**/page.tsx, src/app/squad/panels/page.tsx, src/app/governance/product-owner/page.tsx.

D6 - Média. Contraste fraco em temas escuro/leitura (razão < 3:1, medida por varredura).
- Leitura escuro: /governance ("Abrir Suporte" 1.8), /manual ("Visão Geral & Índice" 1.9), /support ("Enviar Solicitação" 1.9), /sprint-planner ("Voltar ao Hub" 1.0).
- Padrão claro e Leitura claro: /manual (14 a 16 textos de 10px uppercase a 2.6:1), /knowledge/manual (4 textos de 8px a 2.3:1 a 2.5:1), /governance ("Estamos aqui para ajudar." `text-primary` a 2.7:1).
- Alguns botões primários sobre fundo com imagem/degradê podem ser falso positivo; conferir os de /support e /governance com o botão em foco.
- Arquivos: app/manual/components/*, components/knowledge/KnowledgeGuide.tsx e KnowledgeHowToUse.tsx, app/support, app/governance.

D7 - Baixa. Texto abaixo de 12 px e alvos pequenos.
- `text-[8px]`, `text-[9px]`, `text-[10px]` em components/jolt, components/knowledge, ComingSoon e manual (o app-shell.md pede mínimo de 12 px).
- Alvos < 24 px a 375 px: /prompt-hub/tutorial 13, /squad 6, /home 5, /jolt/sandbox 4, /workspace 4, /knowledge/settings 4 (contados com os do cabeçalho; o AppHeader tem ao menos 1 por página, de base).

D8 - Baixa. Corte de conteúdo em 375 px (sem rolagem horizontal da página; todas as 81 rotas ficam sem overflow horizontal da página).
- /knowledge/kb: botões "Sincronizar M..." e KPIs ("0 / 0.0 / 0 DO TDN") cortados na borda direita da área.
- /squad: a faixa de abas rola dentro do contêiner (ok, mas sem indicador de que rola); /governance, /prompt-hub/tutorial e /squad/panels têm tabela com min-width que rola (esperado pelo DataTable? aqui são tabelas próprias, não o DataTable em cartões).

D9 - Baixa. Inglês residual: "Upload" em /prompt-hub/tutorial; "Error" em /devtools/mocks; "Next" em /changelog e /governance (verificar se é texto de interface). "Sandbox", "Hub", "Radar", "Prompt Hub" são nomes de produto. "engenharia" não aparece na copy (só em testes).

## O que ficou sem ver

- Telas ao vivo de sala: /room/{id}, /retro/{id}, /brainstorming/{id}, /health-check/{id}, /showcase/{id}, /action-plan/{id}, /prompt-hub/{id}, /prompt-hub/autor/{id}, /prompt-hub/colecoes/{id}, /manual/{topic}. Existem sessões de Poker e Retro reais na homologação, mas abrir uma sala registra participação.
- /onboarding e fluxo de aceite de /invite/{token}: admin é redirecionado. Só o estado de erro com token inválido foi visto; o resto pelo código.
- /login e /reset-password: exigiriam sair da sessão.
- Temas Midnight, Nebula, Cyberpunk, Nordic e TOTVS (claro e escuro); Padrão escuro só em amostra por captura.
- Tablet (768 a 1279 px) e 1024 px (o app-shell.md manda conferir).
- Console de erros por rota e estados de erro/loading/vazio por tela.
- Capturas completas por rota (só 5 amostras); o restante é DOM, contraste automático e varredura de código.

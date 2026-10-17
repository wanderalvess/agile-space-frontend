# Retro: temáticas visuais por formato

Cada um dos 17 formatos prontos da Retro tem identidade própria: um cenário original atrás das colunas, um ícone de linha 1,5 em cada coluna, estado vazio e placeholder na voz da metáfora, pergunta-guia, quebra-gelo e tempo sugerido por fase. É só front e só visual: nada vai ao backend, o cenário sai do `templateKey` que o quadro já guarda e nenhuma função da sala (arrastar, votar, juntar, fases, timer, presença, "escrevendo…") depende dele.

Especificação de design: boards `RetroTemas` e `RetroTemasSala` do canvas (versão 68).

## Onde está cada coisa

| Peça | Arquivo |
|---|---|
| Mapa `RETRO_FORMAT_THEMES` (cenário, emblema, quebra-gelo, minutos por fase, colunas) e funções de consulta | `src/lib/retro-format-themes.ts` |
| SVG de cada cenário (um arquivo por formato) | `src/components/retro/scenes/<formato>.ts` |
| Carregamento (um `import()` por cenário) | `src/components/retro/retro-scene-loaders.ts` |
| Camada `RetroScene` e miniatura `SceneThumb` | `src/components/retro/RetroScene.tsx` |
| Regras dos três modos e da preferência (puras) | `src/components/retro/retro-scene-mode.ts` |
| Hook `useRetroSceneMode` (preferência + tema Leitura + reduzir movimento + apresentação) | `src/components/retro/useRetroSceneMode.ts` |
| Ícones das colunas (lucide + 5 desenhos próprios) | `src/components/retro/column-icons.tsx` |
| Janela e opções de "Cenário da retro" | `src/components/retro/RetroSceneDialog.tsx` |
| Chip do formato com mini-ícone (lobby) | `src/components/retro/RetroFormatChip.tsx` |
| CSS do cenário (`.retro-scene`, `.retro-on-scene`) | `src/app/globals.css` (bloco no fim) |
| Contraste (funções puras, usadas só no teste) | `src/components/retro/retro-scene-contrast.ts` |

## Regras

- **Cenário padrão: Suave** (parado). **Completo** adiciona paralaxe leve e movimento lento; **Desligado** deixa só o fundo do tema (com o halo de sempre).
- **Preferência pessoal, no navegador** (`agile_retro_scenery`, pelo `useRoomPreference`, com try/catch como o resto do kit). Não vai ao servidor e não muda a retro dos outros. Está no menu "Mais" da barra ("Cenário da retro: Suave") e nas configurações da sala (facilitador). O item do menu some em quadro sem cenário.
- **Tema Leitura confortável desliga toda a decoração**: cenário (também por CSS: `.theme-leitura .retro-scene:not(.retro-scene-thumb) { display: none }`), halo e brilho. As três opções ficam bloqueadas, com aviso. A miniatura do seletor continua visível, porque é prévia de escolha.
- **Apresentar é sempre Suave** (quem escolheu Desligado continua sem cenário). **"Reduzir movimento" do sistema** faz o Completo se comportar como Suave. **Celular** (sem ponteiro fino): sem paralaxe.
- **Movimento só no Completo, só nos 9 formatos que têm metáfora em movimento** (Veleiro, Balão, Carro veloz, Pós-incidente, Estrela-do-mar, Gratidão, Lean Coffee, Mad/Sad/Glad, Fluxo de trabalho; vem das classes `dr`, `bob` e `tw` do SVG e o campo `animado` do mapa é conferido por teste). Só `transform` e `opacity`; nada passa de 26 px; nada pisca rápido.
- **Cenário neutro** (sem ilustração) para formato personalizado, quadro antigo, formato salvo sem chave conhecida e chave desconhecida: `retroSceneKey()` devolve `null`.
- **O cenário nunca vai** para texto, CSV, Markdown nem TDN exportados. PDF e imagem: nada por enquanto.
- **Coluna renomeada pela facilitação** mantém o ícone e esconde pergunta-guia, estado vazio e placeholder do formato (voltam ao genérico do tipo). A comparação é com o título de `RETRO_TEMPLATES` (`isColumnRenamed`).
- **Quebra-gelo** na janela de boas-vindas e na aba "Como funciona" do guia (sem faixa fixa). **Tempo sugerido** por fase: em cada passo das boas-vindas e do guia, e um chip na barra de controles do facilitador ("Sugerido para Escrever: 8 min · Aplicar ao timer") que chama `onSetTimerDuration(minutos * 60)`, a ação que já existia. Só aparece com o timer parado, para o facilitador, em retro aberta.
- **Pergunta-guia** é uma linha (até duas) de 12 px sob o título da coluna, com a frase inteira em dica; vira também o placeholder do campo de novo cartão.
- **Carregamento**: cada cenário é um pacote separado (import dinâmico). A sala baixa só o do formato em uso; o seletor "Nova retro" baixa os 17 ao abrir (miniaturas), e só então.

## Contraste (crítico)

Sobre o cenário, a coluna usa o cartão do tema a 80% com `backdrop-blur-sm` (`bg-card/80`) e o texto secundário vira 50% cinza do tema + 50% texto (`.retro-on-scene .text-muted-foreground`). Os cartões dentro continuam opacos.

`__tests__/retro-scene-contrast.test.ts` lê os tokens reais do `globals.css` (`:root`, `.dark`, `.theme-x`, `.dark.theme-x`, `.theme-x:not(.dark)`), monta as cores que o cenário pode pôr por baixo (`s1` a `s4`, `ac`, `wh`, `ln`, `st`, as mesmas variáveis do CSS), aplica o painel a 80% e exige **4,5:1 (AA) para texto e para texto secundário no pior caso**, nos 7 temas x claro/escuro (Leitura fica de fora: sem cenário). Se mudar uma variável do `.retro-scene` ou o `--primary` de um tema, o teste avisa.

Valores medidos (pior caso, texto / secundário): padrão claro 14,2 / 8,3, padrão escuro 12,8 / 8,5, TOTVS escuro 8,2 / 5,7 (o mais apertado), Nórdica claro 11,4 / 7,0.

## Como adicionar um formato (e o cenário dele)

1. Colunas e chave: `RETRO_TEMPLATES` e `RetroTemplateKey` em `src/lib/types.ts`, e o formato em `RETRO_FORMATS` (`src/lib/retro-formats.ts`).
2. Identidade: uma entrada em `RETRO_FORMAT_THEMES` com `cenario` (a mesma chave), `emblema`, `tag`, `animado`, `quebraGelo`, `temposPorFase` e, **para cada coluna do template**, `icon`, `guia`, `vazio` e `placeholder`. Ícone novo: nome em `RetroColumnIconName` e entrada em `COLUMN_ICONS` (`column-icons.tsx`); sem equivalente no lucide, desenhe de linha 1,5 em 24 px com `lineIcon(...)`.
3. Cenário: `src/components/retro/scenes/<chave>.ts` com `export default '<svg interno>'` (viewBox 1200 x 600, `preserveAspectRatio="xMidYMax slice"`) e uma linha em `RETRO_SCENE_LOADERS`.
   - Três camadas `<g class='p1'>` (longe), `p2` e `p3` (perto): a paralaxe do Completo desloca cada uma.
   - Só as classes do tema: preenchimento `f1`..`f4` (do mais claro ao mais forte, misturando `--primary` com o fundo), `fa` (destaque), `fw` (branco do tema), `fl` (linha), traços `sl` e `sa`. Estilo inline só com `var(--...)`; nada de hexadecimal, `rgb()`, texto, `<image>`, filtro ou `<use>`.
   - Movimento: `dr` (deriva 26 px em 28 s), `bob` (sobe e desce 6 px em 7 s), `tw` (pisca 100% a 35% em 5 s). Só em elementos que a metáfora move; marque `animado: true`.
   - Peso: menos de 8 KB (o maior hoje tem 6,2 KB). Ilustração original e abstrata, sem pessoas, marcas ou produtos TOTVS.
4. `npx vitest run src/lib/__tests__/retro-format-themes.test.ts`: confere os ids de coluna, os textos, o peso, as classes e a ausência de cor fixa. Os cenários de hoje foram gerados por um script de design fora do repositório; os arquivos em `scenes/` são a fonte da verdade daqui em diante.

## Cenário diferente do formato

Não existe: o cenário é sempre o do formato (decisão 4 do board). Escolher outro exigiria um campo novo no quadro (backend) e, sem ele, a escolha valeria só no navegador de quem a fez.

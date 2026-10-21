# Central de Qualidade (descontinuada como módulo)

A Central de Qualidade **deixou de ser um módulo**. Ela virou o filtro **Qualidade** da tela do DevTools (`/devtools?grupo=qualidade`), que reúne 12 ferramentas de vários grupos. O módulo saiu do registro de módulos (`src/lib/modules-registry.ts`): não aparece mais no menu, na Home nem no rodapé. A Home passou de 12 para 11 cartões.

- `/qa` **continua existindo só para redirecionar** a `/devtools?grupo=qualidade` (links salvos não quebram). A busca por "qa", "qualidade" ou "zephyr" no portal leva ao DevTools.
- As ferramentas do filtro: Estúdio de Dados, JWT Inspector, Regex Lab, Diff, UUID e IDs, Cliente HTTP, Massa de Dados, Zephyr Explorer, BDD e Bugs, Gerador de Automação, Fuzz de Limites e Gerador JUnit.
- Sumiram com a descontinuação: o **Estúdio de Mocks** (nada servia o mock; ele só salvava no navegador) e o botão "Criar mock" da Massa de Dados.

Como cada ferramenta funciona e o que sai do navegador: `devtools.md`.

## Onde olhar no código

`src/app/qa/page.tsx` (redirecionamento), `src/lib/devtools/registry.ts` (campo `qa`, `QA_REDIRECT_HREF`), `src/lib/devtools/hub.ts` (aba Qualidade), `src/lib/modules-registry.ts` (alias e `paths: ['/qa']` do DevTools).

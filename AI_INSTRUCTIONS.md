# Agile Space - AI Development Instructions

Este documento define os padrões de desenvolvimento, regras de design e princípios de engenharia para o projeto **Agile Space**. Como assistente de IA, você deve seguir estas diretrizes rigorosamente para manter a consistência e a "Elite Engineering" do ecossistema.

> 📖 **Design System Oficial**: Consulte o arquivo [`design.md`](./design.md) para especificações completas de UI, paleta de cores HSL, tipografia (Outfit/Inter/JetBrains Mono), padrões de componentes (Cards, Tabs, Buttons, Badges) e templates de layout.

---

## 🚀 1. Visão Geral e Filosofia
O **Agile Space** é um hub de colaboração de elite para times ágeis. A prioridade é a **performance**, **densidade de informação** e **estética premium**.
- **Foco**: Eliminar burocracia, maximizar entrega de valor.
- **Estilo**: Glassmorphism, UI de Alta Performance, Minimalismo funcional.

---

## 🛠️ 2. Tech Stack Core
- **Framework**: Next.js 16 (App Router, Turbopack)
- **Linguagem**: TypeScript
- **Estilização**: Tailwind CSS + Shadcn/UI (Tailwind v3)
- **Animações**: Framer Motion (Obrigatório para interatividade)
- **Backend**: Spring Boot (Java), PostgreSQL, Firebase Auth (Identity)
- **Ícones**: Lucide React
- **Estado**: Zustand (Global) / React Context (Local) / React Hook## 💎 3. Padrões de Design "Elite Engineering"
Sempre que criar ou modificar interfaces, aplique estes princípios:

### A. Experiência Zero-Scroll e Otimização de Tela
- Otimize o viewport para que as funcionalidades principais caibam em uma única tela sem necessidade de rolagem sempre que possível.
- Use `h-[100dvh]` ou `h-screen`, `max-h-screen` e `overflow-hidden` estrategicamente na casca principal.
- Áreas internas de listas, logs ou tabelas devem conter rolagem própria (`overflow-y-auto` ou `scroll-area`).

### B. Compactação Tática (High-Density)
- **Espaçamento**: Reduza paddings e margens padrão (ex: de `p-6` para `p-2` ou `p-3`, `gap-2`).
- **Tipografia**: Use fontes menores mas legíveis para labels secundários (`text-[10px]`, `text-[8px]`).
- **Peso**: Use `font-black` ou `font-bold` com `uppercase` e `tracking-widest` para labels de ação.
- **Inputs**: Alturas de campo reduzidas (`h-8` ou `h-10`).

### C. Design Bento (Bento Grid)
- Organize painéis e dashboards em um layout estilo Bento Grid (células de proporções variadas que agrupam informações correlacionadas).
- Cada bloco do grid deve utilizar o componente `AgileBaseCard` ou `EliteCard` com cantos arredondados agressivos (`rounded-[2rem]` ou `rounded-[2.5rem]`).
- Adicione efeitos de hover sutis e transições suaves (`transition-all duration-300 hover:scale-[1.01] hover:shadow-xl`).
- O layout do grid deve fluir para colunas simples em telas menores (`grid-cols-1 md:grid-cols-2 lg:grid-cols-3`).

### D. Padrão de Cores e Temas (Light & Dark Mode)
- **Aderência aos Temas**: Toda e qualquer tela nova ou alterada deve funcionar perfeitamente em modo Claro (Light) e Escuro (Dark).
- **Sem Cores Puras**: Evite cores genéricas como vermelho puro (`red-500`) ou azul padrão do HTML. Utilize paletas HSL calibradas e integradas do Tailwind (ex: `slate-900`, `zinc-950` para dark; `slate-50`, `white` para light).
- **Glassmorphism Premium**:
  - **Fundo**: `bg-white/70 backdrop-blur-xl` ou `bg-slate-900/80 backdrop-blur-2xl` (Dark).
  - **Bordas**: `border border-white/60` ou `border-white/10` (Dark).
  - **Sombras**: `shadow-2xl shadow-slate-500/10` ou `shadow-zinc-950/20` (Dark).

### E. Modelo de Barra Superior (Top Bar / Header)
- O cabeçalho padrão deve usar o componente `RoomHeader` ou respeitar a estrutura de barra superior consistente:
  - Título/Breadcrumbs à esquerda.
  - Seletor de Tema (Claro/Escuro) e Modo de Foco/Calmaria (Focus Mode) à direita.
- O Modo Calmaria (Focus Mode) deve recolher sidebars e painéis secundários desnecessários para focar o usuário apenas na tarefa central da tela atual.

### F. Funcionamento no Mobile (Responsividade)
- **Adaptação Fluida**: Menus e painéis laterais de navegação devem colapsar em gavetas (drawer/sheets) ou no menu hambúrguer em telas menores que `md` (768px).
- **Sem Transbordo (Overflow)**: Monitore e previna o scroll horizontal da página inteira. Use flex-wrap ou grids responsivos para os cards.
- **Áreas de Toque (Touch Targets)**: No mobile, certifique-se de que botões interativos tenham pelo menos `h-10` ou `w-10` para fácil clique, ajustando paddings se necessário.

### G. Padronização de Modais
- Modais e caixas de diálogo devem utilizar o Shadcn UI Dialog ou o `JiraImportDialog` (quando aplicável).
- **Estrutura Visual**: Fundo desfocado (`backdrop-blur-sm`), centralização perfeita, cantos arredondados (`rounded-3xl` ou `rounded-[2rem]`) e sombra profunda.
- **Ações**: Botões de confirmação/ação principal sempre à direita e botão de cancelar à esquerda na base do modal.

### H. Localização
- Toda a interface deve ser em **Português do Brasil (PT-BR)**.
- Use termos amigáveis mas profissionais (ex: "Sincronizando...", "Cofre de Segredos", "Plano de Ação").

---

## 📁 4. Arquitetura e Estrutura de Pastas
Mantenha a separação de responsabilidades rigorosa:

- `src/app/[modulo]`: Páginas e rotas.
- `src/components/[modulo]`: Componentes específicos do módulo.
- `src/components/shared`: Componentes universais (EliteCard, AgileBaseCard, RoomHeader).
- `src/components/ui`: Componentes base (Shadcn).
- `src/hooks`: Lógica compartilhada.
- `src/lib`: Utilitários, types e schemas.

### Convenção de Nomes
- Componentes compartilhados: Prefixo `Agile` ou `Elite` (ex: `AgileSpinner`, `EliteCard`).
- Componentes de módulo: Prefixo do módulo (ex: `RetroCard`, `PokerBoard`).
- Use PascalCase para arquivos de componentes.

---

## 🛠️ 5. Regras de Desenvolvimento

### Ao Criar ou Alterar um Módulo
1. **Estrutura**: Crie a pasta em `src/app/[nome]` e `src/components/[nome]`.
2. **Layout**: Use o componente `RoomHeader` para navegação consistente.
3. **Cards**: Utilize `AgileBaseCard` como base para garantir o estilo visual.
4. **Guia**: Implemente um `[Modulo]Guide` para orientação inline do usuário.
5. **Exportação**: Adicione o componente de exportação universal (PDF/Markdown) se for uma área de dados.

### Código, Performance e Componentização
- **Componentização de Arquivos Grandes**: NUNCA crie arquivos únicos gigantescos. Componentes e páginas com mais de 300 linhas de código devem ser divididos em sub-componentes menores, movendo lógicas de renderização complexas e formulários para sub-arquivos na mesma pasta do componente.
- **Lógica e Hooks**: Extraia lógicas complexas de estados e chamadas de API (REST/WebSocket) para hooks customizados dedicados.
- Use `'use client';` apenas quando necessário.
- Priorize `lucide-react` para todos os ícones.
- Utilize `cn()` do `lib/utils` para manipulação de classes Tailwind.
- Siga as regras de lint e tipagem estrita do TypeScript.
- **Importante**: Sempre verifique o `CHANGELOG.md` para entender as últimas mudanças e não reintroduzir bugs ou padrões obsoletos.

---

## 🤖 6. Comportamento da IA
- **Não "vague"**: Não proponha soluções fora da stack ou do padrão visual estabelecido.
- **Seja Proativo com o Design**: Se um componente parecer "genérico", refine-o usando os tokens de Glassmorphism, design Bento e compactação tática.
- **Consistência**: Antes de criar algo novo, pesquise se já existe um componente `shared` ou padrão já implementado que possa ser reaproveitado ou estendido.
- **Elite Standard**: Mantenha o nível de "Elite Engineering" - código limpo, UI impactante e zero erros de hidratação.

---

## 🛡️ 7. Verificação de Integridade de Código

Para evitar erros comuns de sintaxe e quebras de build, siga estas regras antes de finalizar qualquer edição:

### A. Validação de Fechamento de Tags e Chaves
- **Erro Crítico**: Nunca deixe chaves (`}`) ou tags JSX (`</div>`, `);`) duplicadas ou órfãs ao final de um arquivo após um `replace_file_content`.
- **Verificação**: Antes de aplicar a mudança, certifique-se de que o bloco de substituição mantém o balanceamento exato de abertura/fechamento do componente.

### B. Gestão de Imports (Lucide-React e UI)
- Ao adicionar novos ícones ou componentes, **sempre** verifique se o import correspondente no topo do arquivo foi atualizado.
- **Verificação Obrigatória**: Após editar um arquivo, verifique se não restaram imports não utilizados (Unused Imports) ou duplicados no mesmo bloco.
- Nunca assuma que um ícone (ex: `Settings`, `Menu`, `Copy`) já está importado; verifique a lista explicitamente.
- Mantenha os imports de `lucide-react` agrupados em um único bloco de desestruturação para evitar redundância.

### C. Continuidade de Código
- Ao editar funções longas, certifique-se de não "cortar" acidentalmente o final da função ou exportações subsequentes.
- Verifique se a exportação default (`export default function...`) permanece intacta e no final do arquivo.

### D. Padrão Anti-Bug
- Se um erro de sintaxe ocorrer (`Expression expected`, `Unexpected token`), a prioridade número 1 é o **rollback e correção imediata** antes de prosseguir com novas funcionalidades.

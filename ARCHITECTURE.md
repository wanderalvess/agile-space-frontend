# Espaço Ágil - Architecture & Context Map (Repomap)

Este documento fornece um mapeamento técnico completo do ecossistema **Espaço Ágil**, servindo como fonte da verdade para a estrutura do projeto, domínios de negócio e fluxos de dados.

---

## 1. Visão Geral da Arquitetura
O **Espaço Ágil** é uma aplicação **Next.js 15 (App Router)** de alta performance, projetada para ser síncrona e colaborativa em tempo real.

- **Frontend**: React 19 com renderização híbrida. Interfaces baseadas em Glassmorphism e animações fluidas com Framer Motion.
- **Backend (Real-time)**: Utiliza **Spring Boot + PostgreSQL** com **WebSockets Nativos** como barramento de eventos e banco de dados.
- **Sincronização**: A sincronização é feita através de conexões WebSocket para notificações (e.g., `REFRESH_BOARD`) e chamadas REST (via axios/fetch) para persistência e recuperação de dados de forma eficiente.

---

## 2. Mapa de Domínios (Business Domains)

### 🃏 Scrum Poker (Elite Style)
- **Rota Principal**: `src/app/room/[id]/page.tsx`
- **Componentes Chave**: `src/components/poker/PokerRoom.tsx`, `src/components/poker/AsyncPokerRoom.tsx`, `src/components/poker/VotingArea.tsx`, `src/components/poker/Results.tsx`.
- **Responsabilidade**: Facilita estimativas técnicas (Fibonacci/T-Shirt/Horas) em modos síncrono e assíncrono.

### 🔄 Retrospectiva
- **Rota Principal**: `src/app/retro/page.tsx` e `src/app/retro/[id]/page.tsx`
- **Componentes Chave**: `src/components/retro/RetroBoard.tsx`, `src/components/retro/RetroCard.tsx`, `src/components/retro/RetroColumn.tsx`.
- **Responsabilidade**: Cerimônia de retrospectiva síncrona com colunas de feedback, votação e geração de itens de ação.

### 📅 Sprint Planner (Engenharia de Capacidade)
- **Rota Principal**: `src/app/sprint-planner/page.tsx`
- **Componentes Chave**: `src/components/planner/SprintPlannerContent.tsx`, `src/components/planner/PlannerGuide.tsx`.
- **Responsabilidade**: Planejamento de capacidade da squad com métricas reais de foco e horas disponíveis.

### 🎬 Sprint Showcase (Cinematic Evolution)
- **Rota Principal**: `src/app/showcase/page.tsx`
- **Componentes Chave**: `src/components/showcase/TeatroMode.tsx`, `src/components/showcase/TaskCard.tsx`, `src/components/showcase/ShowcaseCover.tsx`.
- **Responsabilidade**: Interface cinematográfica para apresentação dos resultados da sprint.

### ⚡ Daily Flow & Helper
- **Rota Principal**: `src/app/daily-flow/page.tsx` e `src/app/daily-helper/page.tsx` (Nota: Helper costuma ser um submódulo).
- **Componentes Chave**: `src/components/daily-flow/DailyFlowGuide.tsx`, `src/app/daily-flow/SquadManagementSheet.tsx`.
- **Responsabilidade**: Mural de sincronização assíncrona para status diários e impedimentos.

### 🧠 Knowledge Base (Base de Conhecimento)
- **Rotas Principais**:
  - `src/app/knowledge/page.tsx`: Landing page e busca global.
  - `src/app/knowledge/kb/page.tsx`: Visualização de documentos organizados em cartões Bento Grid (Bento Grid Cards) responsivos de alta densidade.
  - `src/app/knowledge/admin/page.tsx`: Painel administrativo com suporte para:
    - Download em massa (múltiplos arquivos simultaneamente).
    - Sincronização e busca de manuais no TDN via modal padronizado de importação (recebe URL, chave e query).
- **Componentes Chave**: `src/components/knowledge/GlobalSearch.tsx`, `src/components/knowledge/KnowledgeSidebar.tsx`, `src/components/knowledge/TdnImportDialog.tsx`.
- **Responsabilidade**: Repositório estruturado de ativos técnicos com busca semântica e integração com sistemas externos.

### 🛡️ Secret Vault (Cofre de Segredos)
- **Rota Principal**: `src/app/vault/[id]/page.tsx`
- **Componentes Chave**: Lógica de criptografia em `src/lib/vault-crypto.ts`.
- **Responsabilidade**: Compartilhamento seguro de segredos com criptografia zero-knowledge (AES-GCM).

### 🛠️ DevTools Hub & Jolt Engine
- **Rota Principal**: `src/app/devtools/page.tsx` e `src/app/jolt/page.tsx`
- **Componentes Chave**: `src/lib/jolt-lite.ts` (Motor de transformação), `src/components/devtools/*`.
- **Ferramentas Disponíveis**:
  - **Dados**: Utilidades JSON, XML, Validador Schema, Formatador SQL, Fábrica de Mocks, Gerador de Documentos.
  - **Transformação**: Sandbox Jolt, Mapeador Visual Jolt, Conversor YAML/JSON.
  - **Segurança**: Decodificador Universal, Inspetor JWT, Certificados, Rede & IP Analyzer.
  - **Geradores**: Tipagens (TypeScript), Snippets de API, UUIDs, JUnit Tests.
  - **Utilidades**: Base64, Regex Lab, Consulta CEP, Data & Hora, Diff Viewer, Cron Decoder, URL Encoder.
- **Responsabilidade**: Suíte de utilitários técnicos para desenvolvedores e engine de transformação de dados.

### 📊 Radar de Saúde (Health Check)
- **Rota Principal**: `src/app/health-check/page.tsx`
- **Componentes Chave**: `src/components/health-check/*`.
- **Responsabilidade**: Diagnóstico anônimo do clima e cultura da squad.

### 📚 Biblioteca de IA (Prompt Hub)
- **Rota Principal**: `src/app/prompt-hub/page.tsx`
- **Rotas Auxiliares**: `src/app/prompt-hub/[id]/page.tsx` (link compartilhável), `autor/[authorId]/page.tsx` (perfil), `colecoes/page.tsx` e `colecoes/[id]/page.tsx` (trilhas), `tutorial/page.tsx` (guia de skills), `seed/page.tsx` (carga inicial, restrita a admin).
- **Componentes Chave**: `src/app/prompt-hub/components/*` (catálogo, card, editor, detalhe, coleções) e `src/components/prompt-hub/PromptGuide.tsx` (painel de ajuda).
- **Coleções Firestore**: `prompt_hub` (+ subcoleção `comments`), `prompt_collections`, `users/{uid}/prompt_favorites`.
- **Responsabilidade**: Acervo de ativos de IA da empresa — prompts, skills, agentes, Gems, instruções, workflows, MCP e recursos —, com descoberta, reaproveitamento e trilhas.
- **Detalhes**: ver `src/app/prompt-hub/requisitos.md`.

### 📋 Plano de Ação (Action Plan)
- **Rota Principal**: `src/app/action-plan/page.tsx` e `src/app/action-plan/[id]/page.tsx`
- **Componentes Chave**: `src/components/action-plan/*`.
- **Responsabilidade**: Gestão e acompanhamento visual de planos de ação táticos da squad.

### 💡 Ideação & Brainstorming
- **Rota Principal**: `src/app/brainstorming/page.tsx` e `src/app/brainstorming/[id]/page.tsx`
- **Componentes Chave**: `src/components/brainstorming/*`.
- **Responsabilidade**: Facilitação de dinâmicas síncronas de ideação do time.

### ⏱️ Modo Foco (Focus Area)
- **Rota Principal**: `src/app/focus/page.tsx`
- **Componentes Chave**: `src/app/focus/*` e helpers de som ambiente.
- **Responsabilidade**: Ambiente de trabalho pomodoro individual focado.

### 🏢 Workspace Dashboard
- **Rota Principal**: `src/app/workspace/page.tsx`
- **Componentes Chave**: `src/components/workspace/*`.
- **Responsabilidade**: Painel analítico unificado da squad.

### ⚖️ Governança (Governance)
- **Rota Principal**: `src/app/governance/page.tsx`
- **Responsabilidade**: Painéis de conformidade, auditoria e acompanhamento de métricas do ecossistema.

---

## 3. Componentes Compartilhados (Shared Design System)

Para evitar redundância, utilize sempre os componentes em `src/components/shared/`:

- **EliteCard / AgileCard**: Wrapper principal de cartões com suporte a múltiplos temas e variações.
- **AgileBaseCard**: O componente atômico de cartão com Glassmorphism.
- **RoomHeader**: Cabeçalho padrão para módulos administrativos e salas de cerimônia. Inclui breadcrumbs, controle de tema (claro/escuro) e o botão do modo de foco (modo calmaria).
- **EliteSidebar**: Menu lateral padrão de navegação interna.
- **EliteTimer**: Componente universal de cronômetro.
- **JiraImportDialog**: Componente unificado para importação de tarefas do Jira via XML/JSON.
- **TdnImportDialog**: Componente unificado para importação e atualização de manuais do TDN.
- **AgileSpinner**: Indicador de carregamento padrão do sistema.

---

## 4. Fluxo de Dados (State & Persistence)

### Estado Global
- **UserContext** (`src/context/UserContext.tsx`): Gerencia a identidade do usuário (Auth Firebase), perfil global e anonimização.
- **SystemConfigContext** (`src/context/SystemConfigContext.tsx`): Configurações globais de sistema e flags.

### Persistência e Sync (API & WebSockets)
A aplicação não usa Redux/Sagas de forma pesada. O estado em tempo real é gerenciado assim:
- **REST API**: Funções encapsuladas em diretórios `api` ou serviços no frontend (ex: `retroApi`) para ler/escrever no backend Spring Boot.
- **WebSockets**: Conexões nativas aos handlers do Spring Boot (`/ws/...`) para receber sinais de atualização e coordenar re-fetches sem sobrecarregar o cliente.

### Utilitários de Negócio
- `src/lib/types.ts`: Definições globais de interfaces TypeScript.
- `src/lib/utils.ts`: Funções utilitárias de formatação e manipulação de classes Tailwind (`cn`).
- `src/lib/jolt-lite.ts`: Engine core para transformações JSON complexas.

---

## 5. Regras de Integridade e Componentização

1. **NUNCA** duplique a lógica de conexão com o backend; utilize as instâncias centralizadas de API e WebSocket.
2. **NUNCA** crie componentes de card do zero; estenda o `AgileBaseCard` ou `EliteCard`.
3. **RESPEITE** a separação de domínios em `src/components/[modulo]`.
4. **COMPONENTIZAÇÃO OBRIGATÓRIA**: Arquivos que excedam 300 linhas de código devem ser imediatamente divididos em componentes menores. A lógica do estado local ou hooks pesados devem ser isolados em hooks personalizados.
5. **REAPROVEITAMENTO**: Antes de criar qualquer novo modal, diálogo ou formulário, estude os componentes compartilhados e busque a padronização visual com o resto do sistema.
6. **RESPONSIVIDADE E TELA**: Garanta o aproveitamento máximo do espaço de tela (`h-screen`, `flex-1`, grids eficientes) sem transbordamentos na visualização mobile.


# Agile Space

**Elimine a fricção da burocracia ágil. Foque em entregar software de valor.**

O **Agile Space** é o hub de colaboração definitivo projetado para times de elite. Ele centraliza ferramentas como Scrum Poker, Retrospectiva, Sprint Planner, Base de Conhecimento e ferramentas avançadas para desenvolvedores em uma única interface síncrona, auditável e focada na performance real do time.

---

## 🚀 Funcionalidades Principais

### 🃏 Scrum Poker (Elite Style)
*Disponível nos Modos Síncrono e Assíncrono*
Estimativas em Fibonacci, T-Shirt ou Horas encapsuladas em uma **UI Glassmorphism** de Alta Performance. 
- **Modo Síncrono (Ao Vivo):** Votação guiada pelo facilitador em tempo real.
- **Modo Assíncrono (Remoto):** Feed de tarefas onde a equipe vota simultaneamente no próprio tempo.
- **Consenso Inteligente por Role:** Avaliação de concordância por Papel (Role).
- **Varredura Visual de Divergência:** Alertas semafóricos silenciosos (amarelo/vermelho) quando há distanciamento grave nas estimativas.
- **Ponte com o Planner:** Importação rápida do escopo do Sprint Planner diretamente para votação.

### 📅 Sprint Planner (Engenharia de Capacidade)
*Cerimônia Pre-Planning Síncrona/Assíncrona*
- **Engine de Capacidade Flexível:** Alterne entre "Modo Simples" (Cálculo em massa) e "Modo Detalhado" (Individual com foco e férias).
- **Importação em Lote Inteligente:** Cole listas brutas (`Título | Link | Descrição`) para construir cards instantaneamente.
- **Tracking de Sobrecarga:** Termômetros de desenvolvimento e qualidade em tempo real.
- **Exportação e Compartilhamento:** Geração de links somente-leitura.

### 🧠 Knowledge Base (Base de Conhecimento)
Repositório centralizado de ativos técnicos do time.
- **Design Bento Grid**: Documentos exibidos em cartões Bento altamente informativos e estéticos.
- **Download em Massa**: Baixe múltiplos manuais e arquivos simultaneamente na área de administração.
- **Integração com TDN**: Modal interativo para buscar e sincronizar manuais técnicos diretamente de plataformas externas via URL, chave e query.

### 🛡️ Secret Vault (Cofre de Segredos)
Compartilhamento seguro de segredos e credenciais com criptografia zero-knowledge no lado do cliente (AES-GCM).

### 🛠️ DevTools Hub & Jolt Engine
Suíte de utilitários técnicos de alta performance para desenvolvedores:
- **Sandbox Jolt**: Transformador de estruturas JSON usando a especificação Jolt de forma rápida e visual.
- **Fábrica de Mocks**: Gerador de dados fictícios em massa com importação DDL e exportação SQL/JSON.
- **Utilitários de Dados & Segurança**: Formatador de SQL/JSON, inspetor JWT, decodificador cron, codificador base64, e regex lab.

### 📊 Radar de Saúde (Team Health Check)
Mapeamento anônimo do clima da Squad em múltiplas dimensões técnicas e culturais.

### 📋 Plano de Ação (Action Plan)
Criação e monitoramento de planos de ação ágeis, com atribuição de responsáveis, definição de prazos e acompanhamento de tarefas integradas ao time.

### 💡 Ideação & Brainstorming
Espaço colaborativo e síncrono estruturado para facilitação de dinâmicas de brainstorm de ideias, arquitetura de soluções e design participativo.

### ⏱️ Modo Foco (Focus Area)
Ambiente pessoal de concentração extrema equipado com cronômetros Pomodoro customizados, controle de tarefas do dia e trilhas sonoras Lo-Fi/ambientais integradas.

### 🏢 Workspace Dashboard
Painel consolidado da Squad com métricas de progresso das sprints, links rápidos, visão geral do time e consolidação dos status de trabalho.

### ⚖️ Governança & Suporte
- **Governance**: Acompanhamento e auditoria dos processos e métricas ágeis da organização.
- **Support & Manual**: Central de suporte rápido do time e guia de manuais integrados do ecossistema.

---

## 🎨 Diretrizes de Estilo e Desenvolvimento (Elite Engineering)

Seguimos um conjunto estrito de regras de design e engenharia para manter a consistência estética e de performance:

- **Bento Design**: Interfaces construídas sob grids bem organizadas e estéticas.
- **Experiência Zero-Scroll**: Otimização do layout principal para evitar rolagem de tela principal (use painéis de scroll internos).
- **Glassmorphism Premium**: Fundos desfocados (`backdrop-blur-xl`), bordas finas e translúcidas, e sombras suaves.
- **Suporte Total Light/Dark Mode**: Adaptação perfeita para temas claro e escuro.
- **Responsividade e Mobile**: Layouts adaptativos (uso de gavetas/drawers em mobile) sem barra de rolagem horizontal indesejada.
- **Componentização**: Arquivos limitados a **300 linhas de código**. Componentes maiores devem ser divididos e lógicas pesadas extraídas para hooks customizados.

---

## 📂 Organização de Regras, Conhecimento e Infra

Para entender as regras e configurações do projeto, consulte os arquivos abaixo:

* **Estilo e Código**: [AI_INSTRUCTIONS.md](file:///c:/Users/wanderson.alves/projetosWanderson/Agile-Space/AI_INSTRUCTIONS.md)
* **Conhecimento e Arquitetura**: [ARCHITECTURE.md](file:///c:/Users/wanderson.alves/projetosWanderson/Agile-Space/ARCHITECTURE.md)
* **Regras de Infra**:
  - Deploy & Hosting: [apphosting.yaml](./apphosting.yaml)
  - Configurações Core: [firebase.json](./firebase.json)

---

## 🛠️ Tecnologias

- **Frontend:** Next.js 16 (App Router, Turbopack), React 19, Tailwind CSS e Shadcn/UI
- **Backend & Database:** Spring Boot (Java), PostgreSQL, WebSockets Nativos, Firebase Auth (Apenas Identidade)
- **Interatividade & Animação:** `@dnd-kit`, Framer Motion, Tailwind Animate
- **Gráficos & Visualização:** Recharts
- **Ferramentas Adicionais:** Monaco Editor, Zod

---

## 🏁 Como Rodar Localmente

1. Instale as dependências com NPM:
   ```bash
   npm install
   ```

2. Inicie o servidor de desenvolvimento utilizando o Turbopack na porta `9002`:
   ```bash
   npm run dev
   ```

3. Acesse o aplicativo no seu navegador em [http://localhost:9002](http://localhost:9002).

---

## 🐳 Rodando com Docker

Este repositório tem seu próprio `Dockerfile` (build standalone do Next.js, porta `9002`), mas a stack completa — frontend + backend + PostgreSQL dedicado — é orquestrada pelo `docker-compose.yml` do repositório [`agile-space-backend`](https://github.com/wanderalvess/agile-space-backend).

Clone os dois repositórios lado a lado:
```
algum-diretorio/
├── agile-space-backend/   (contém o docker-compose.yml)
└── agile-space-frontend/  (este repo)
```

E rode a partir do `agile-space-backend`:
```bash
docker compose up -d --build
```

Detalhes completos (variáveis de ambiente, rebuild, isolamento de banco) no [README do backend](https://github.com/wanderalvess/agile-space-backend#-rodando-com-docker).
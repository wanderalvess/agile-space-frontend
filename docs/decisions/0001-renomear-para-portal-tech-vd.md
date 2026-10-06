# 0001 — Renomear o sistema para "Portal Tech V&D"

- **Data:** 2026-10-06
- **Status:** Aceita
- **Decisores:** time do produto (definido em conversa com o mantenedor)

## Contexto

O sistema nasceu como **Espaço Ágil**, um hub genérico de cerimônias ágeis. Ele passa a ter um propósito
mais específico: ser o hub de tecnologia da área de **Varejo e Distribuição (V&D)**. As funções deixam de ser
um conjunto genérico e passam a ser organizadas com sentido de negócio.

Fluxos prioritários, que precisam funcionar e se integrar bem: login, cadastro de contas, onboarding
(conectar o time e o Jira), Scrum Poker, Review e Retro.

## Decisão

1. O nome do produto passa a ser **Portal Tech V&D** (V&D = Varejo e Distribuição).
2. A troca vale para tudo que o usuário vê, no **frontend** e no **legado**: logo em texto, títulos de aba,
   manifest do PWA, textos de tela, PDFs exportados, prompt do assistente de IA, documentação e testes.
3. É o **mesmo hub**; só muda o nome e o propósito. Nenhuma funcionalidade foi removida.

## O que NÃO muda (por enquanto)

| Item | Motivo |
|------|--------|
| Domínio (`espacoagil.com.br`) | Ainda em organização. Será revisto em decisão própria. |
| Ícone (foguete) e paleta | Identidade visual ainda não definida. |
| Identificadores técnicos: chaves de `localStorage` (`agile-space:*`), nomes de pacote, repositórios, banco, backend `agile-space-backend` | Trocar desloga usuários e invalida dados salvos sem ganho visível. |
| Histórico do changelog (`versions.json`) | É registro do que foi publicado com o nome antigo. |
| Backend (Spring Boot) | Fora desta etapa; textos do servidor seguem como estão. |

## Consequências

- O nome configurável no admin (`companyName`) pode estar salvo com "Espaço Ágil" no banco. No frontend,
  esse valor antigo é tratado como o padrão, não como nome customizado. No legado, o valor vem do Firestore e deve
  ser atualizado pelo painel de administração.
- Links, e-mails e materiais externos que citam "Espaço Ágil" precisam ser atualizados manualmente.
- Quando o domínio e o ícone forem definidos, registrar novas decisões em `docs/decisions/`.

## Como foi feito

Substituição textual controlada (preservando concordância: "do Espaço Ágil" → "do Portal Tech V&D"),
exceto identificadores técnicos e o histórico do changelog. Verificado com `tsc` e com a tela de login no navegador.
Entrada de changelog publicada para os usuários (frontend v4.1.0, legado v3.118.0).

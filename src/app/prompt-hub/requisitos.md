# Biblioteca de IA (Prompt Hub): requisitos

Os dados vivem no backend Spring Boot + PostgreSQL (não há mais Firestore). Detalhes de telas e regras:
`docs/fluxos/biblioteca-ia.md`.

## Funções que a tela garante
- 8 tipos: prompt, skill, agente, Gem, instrução, fluxo de trabalho, MCP e recurso.
- Campos `{{nome}}` preenchidos antes de copiar (substituição numa passada, sem interpretar `$&`).
- Copiar, preencher, abrir ferramenta (Gem conta o uso), duplicar, favoritar (na conta), copiar link.
- Discussão de até 4000 caracteres; remove quem escreveu, a dona do item e a administradora.
- Skill e recurso em modo formatado ou cru; ficha técnica só com o cargo da pessoa autora.
- Conferência ao vivo do SKILL.md (erros bloqueiam, avisos não); aviso de itens parecidos (nunca bloqueia).
- Etiquetas (máx. 30; a pendente entra ao publicar); detalhes de iniciativa; confirmação ao sair sujo.
- Importar pasta (lote de até 200, com fallback item a item), coleções ordenadas, página da pessoa, tutorial.
- Leitura pública sem login; links só `http(s)`.

## Contrato com o backend
- `GET /api/prompts?query&type&visibility&status&impact&tag&favorites&authorId&sort&page&size`
  (o formato novo liga quando vem `sort` ou algum filtro; o cliente sempre manda `sort`).
- `GET /api/prompts/facets` (mesmos filtros), `POST|DELETE /api/prompts/{id}/favorite`,
  `GET /api/prompts/{id}/versions[/{n}]`, `POST /api/prompts/{id}/versions/{n}/restore`, `GET /api/prompts/{id}/usage?weeks=8`.
- Rotas públicas em `/api/public/prompt-hub/{items,facets,collections}` (coleções públicas: ver relatório de entrega).

## Limitações
- Sem compartilhamento por squad ou cargo (só Privado e Público).

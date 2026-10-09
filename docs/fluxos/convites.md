# Convites

Estado do `develop` em 2026-10-09.

## Objetivo e quem usa

Levar alguém a uma equipe com um **papel de negócio** definido por quem lidera, sem depender de o e-mail do Jira bater com o do login. É o caminho de quem tem papel de liderança e não foi reconhecido automaticamente (ver `onboarding-e-papeis.md`).

- **Quem cria e revoga:** admin do sistema, `LEAD` do sistema, ou liderança **daquela** equipe (cargo de liderança no `jobTitle`, ou linha de liderança no roster da equipe) — e só se a equipe é a ativa/padrão da pessoa.
- **Quem aceita:** qualquer pessoa logada com o link (e, se o convite tem e-mail, só a conta com aquele e-mail).

## Telas

| Tela | Caminho |
|---|---|
| Aceitar convite | `/invite/[token]` (exige login; sem sessão oferece "Entrar ou criar conta" e volta ao convite) |
| Gerenciar convites da equipe | tela da equipe (`/squad`): criar, copiar link, listar, revogar |

## Fluxo principal

```mermaid
sequenceDiagram
    participant L as Liderança
    participant B as Backend
    participant P as Convidado
    L->>B: POST /api/squads/{id}/invites {roleName, email?}
    B-->>L: convite PENDING com token e validade de 7 dias
    L->>P: envia o link /invite/<token> (fora do sistema)
    P->>B: GET /api/invites/{token}
    B-->>P: papel, equipe, status
    P->>B: POST /api/invites/{token}/accept
    B->>B: trava a linha, confere PENDING, validade e e-mail
    B->>B: cria o membro na equipe com o papel do convite
    B-->>P: membro criado; convite ACCEPTED
```

## Estados e transições

| Estado | Como entra | Sai para |
|---|---|---|
| `PENDING` | criação | `ACCEPTED` (aceite), `REVOKED` (liderança revoga), `EXPIRED` (aceite ou consulta depois dos 7 dias) |
| `ACCEPTED` | aceite | — (histórico; não pode ser revogado) |
| `REVOKED` | liderança | — |
| `EXPIRED` | tentativa de aceite vencido | — |

## Regras

- **Token:** UUID aleatório sem hífens (122 bits, gerador seguro), único no banco. Não é previsível.
- **Validade:** 7 dias fixos.
- **Uso único:** o aceite lê o convite com **trava de linha**; dois aceites simultâneos do mesmo link não passam os dois.
- **Com e-mail:** só aquela conta aceita (403 "endereçado a outro e-mail"). **Sem e-mail:** o link vale para quem o tiver e estiver logado — tratar o link como senha.
- **O convite nunca muda `User.role`** (nível de sistema); só vincula a pessoa à equipe com o papel do convite.
- **Validação:** papel obrigatório (até 80 caracteres), e-mail com `@` (até 254).
- **Auditoria:** criação, aceite e revogação gravam em `audit_logs`.
- **Consulta do convite** (`GET /api/invites/{token}`): qualquer pessoa logada com o token; devolve o convite inteiro (inclui quem convidou e e-mail destinatário). O frontend não mostra convite que não está mais pendente.

## Permissões: servidor x cliente

Toda a checagem é do servidor (`InviteController.requireInviteAccess`). O cliente só esconde botões. Listagem de convites da equipe inclui os **tokens**, então vale o mesmo cuidado.

## Dados guardados

Convite (equipe, papel, e-mail opcional, quem convidou, status, datas, quem aceitou) e o membro criado na equipe.

## Pontos frágeis e erros de fluxo conhecidos

**Corrigido nesta rodada:** aceite sem trava (corrida abria uso duplo do link); revogar convite já aceito apagava o rastro de quem entrou; papel e e-mail sem validação; erro da API aparecia ao usuário como JSON cru em inglês; botão "Aceitar" aparecia para convite já usado/cancelado/vencido.

**Não corrigido:**

1. **Quem cria define o papel livremente**, inclusive de liderança. É o desenho atual (convite é o canal de liderança), mas a lista de papéis não é validada contra um catálogo (o catálogo ainda é código; ver `onboarding-e-papeis.md`). Qualquer liderança da equipe pode convidar outra pessoa como liderança.
2. **Liderança é reconhecida também pelo `jobTitle`** (cargo gravado só por admin; ok) **e pela equipe ativa/padrão** da pessoa. Quem lidera várias equipes só convida na equipe ativa no momento.
3. **Sem limite de convites** nem por equipe nem por pessoa; sem limite de taxa específico além do geral de `/api/**`.
4. **Convite sem e-mail pode ser aceito por quem encontrar o link** (ex.: colado num canal público). Recomendação de uso: preencher o e-mail.
5. **Datas** do convite saem da API em UTC com `Z` (desde 09/10/2026) e o navegador converte para o horário local; a validade é conferida no servidor.
6. **Convite não é reenviado/estendido**: venceu, cria outro.

## Onde olhar no código

- Backend: `controller/InviteController`, `service/InviteService`, `repository/InviteRepository` (leitura com trava), `domain/Invite`, migration `V8__create_invites_table.sql`.
- Frontend: `app/invite/[token]/page.tsx`, `lib/invite-api.ts`.
- Testes: `service/InviteServiceTest`.

// Fluxo 3 do plano de testes: membro importado do Jira cria a própria conta e fica vinculado.
// Reproduz, via SQL direto, exatamente o que JiraAdminService.confirmSync grava quando
// syncUsers=true (squad_members + um User "fantasma" sem senha e inativo) e então valida que
// o cadastro real da pessoa (AuthService.register) reivindica essa conta em vez de bloquear com
// 409 — é o teste que prova a correção aplicada em 2026-09-11 em AuthService.java.
//
// Requer `docker` no PATH e o container do Postgres do docker-compose local rodando
// (container_name: agile-space-db, ver docker-compose.yml do backend). Se não achar o
// container, o teste falha alto e claro em vez de silenciosamente testar o caminho errado.

describe('Claim de conta pré-provisionada pelo sync do Jira', () => {
  it('pessoa da squad cadastra a própria conta com o e-mail do Jira e consegue logar em seguida', () => {
    const unique = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const squadId = `QACLAIM${unique}`.toUpperCase();
    const jiraAccountId = `acc-${unique}`;
    const email = `qa.claim.${unique}@empresa.com.br`;
    const displayName = 'Membro Importado QA';

    // Simula o squad_members + User fantasma que JiraAdminService.confirmSync(syncUsers=true) cria.
    cy.psql(
      `INSERT INTO squad_members (db_id, squad_id, jira_account_id, display_name, email, role, capacity_hours_per_day) ` +
        `VALUES ('${squadId}_${jiraAccountId}', '${squadId}', '${jiraAccountId}', '${displayName}', '${email}', 'Developer', 8.0);`
    );
    cy.psql(
      `INSERT INTO users (id, email, name, squad_id, jira_account_id, is_active, is_guest) ` +
        `VALUES ('${jiraAccountId}', '${email}', '${displayName}', '${squadId}', '${jiraAccountId}', false, false);`
    );

    // A pessoa de verdade chega e cria a própria conta com esse e-mail exato.
    cy.visit('/login');
    cy.openRegisterTab();
    cy.contains('label', 'Nome Completo').parent().find('input').type(displayName);
    cy.get('input[type="email"]').type(email);
    cy.get('input[type="password"]').type('SenhaForte123');
    cy.contains('button', 'Criar Conta').click();

    // Antes da correção: 409 "e-mail já cadastrado". Depois: cadastro sucede normalmente.
    cy.contains('Erro no cadastro').should('not.exist');
    cy.contains('Conta criada com sucesso!');

    // A UI pode passar rapidinho pelo onboarding (o projeto não tem ProjectConfig, só Squad —
    // ver nota no checklist) mas o gate final (IdentityGatekeeper, baseado em squadId) não deve
    // deixar a pessoa presa lá.
    cy.url({ timeout: 10000 }).should('not.include', '/onboarding');

    // Logout e login de novo com a senha recém-definida: a conta precisa estar ativa.
    cy.window().then((win) => win.localStorage.clear());
    cy.visit('/login');
    cy.get('input[type="email"]').type(email);
    cy.get('input[type="password"]').type('SenhaForte123');
    cy.contains('button', 'Acessar Plataforma').click();

    cy.contains('Falha na autenticação').should('not.exist');
    cy.url({ timeout: 10000 }).should('not.include', '/login');
  });
});

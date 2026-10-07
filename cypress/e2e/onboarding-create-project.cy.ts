// Fluxo "Criar Novo Projeto" do onboarding (caminho sem Jira) — cadastro novo, sem squad
// vinculada, cria um projeto do zero e vira Agile Master dele. Complementa o checklist manual
// (que cobre o caminho via Jira, que precisa de credencial real).

describe('Onboarding — Criar Novo Projeto (sem Jira)', () => {
  it('usuário novo cria projeto do zero e vira Agile Master', () => {
    const unique = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const email = `qa.create.${unique}@empresa.com.br`;
    const projectName = `Squad QA ${unique}`;

    cy.visit('/login');
    cy.openRegisterTab();
    cy.contains('label', 'Nome Completo').parent().find('input').type('QA Create Project');
    cy.get('input[type="email"]').type(email);
    cy.get('input[type="password"]').type('SenhaForte123');
    cy.contains('button', 'Criar Conta').click();

    cy.url({ timeout: 10000 }).should('include', '/onboarding');

    cy.contains('label', 'Nome do Projeto').parent().find('input').type(projectName);
    cy.contains('button', 'Começar').click();

    cy.url({ timeout: 10000 }).should('include', '/squad/roster');
    cy.contains('Não foi possível criar o projeto').should('not.exist');
  });
});

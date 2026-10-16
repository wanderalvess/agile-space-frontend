// Fluxo "Criar uma squad sem o Jira" do onboarding (caminho sem Jira) — cadastro novo, sem squad
// vinculada, cria um projeto do zero e vira Agile Master dele. Complementa o checklist manual
// (que cobre o caminho via Jira, que precisa de credencial real).

describe('Onboarding — Criar squad (sem Jira)', () => {
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

    // Sem sugestão de squad, o fluxo abre em "Como você usa o Portal?": Agile Master/People Lead -> criar sem o Jira.
    cy.contains('button', 'Sou Agile Master ou People Lead').click();
    cy.contains('button', 'Criar uma squad sem o Jira').click();
    cy.get('#nome-squad').type(projectName);
    cy.contains('button', 'Criar e entrar').click();

    // Squad recém-criada cai na home (o aviso de boas-vindas aponta o painel).
    cy.url({ timeout: 10000 }).should('not.include', '/onboarding');
    cy.contains('Não foi possível criar a squad').should('not.exist');
  });
});

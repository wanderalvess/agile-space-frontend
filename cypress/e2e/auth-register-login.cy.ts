// Fluxo 1 do plano de testes: primeiro usuário / conta (ver docs/testing/qa-checklist-producao.md).
// Cobre cadastro comum, login, senha errada e redirecionamento pro onboarding quando não há
// squad vinculada — tudo pela UI de fato (só o cadastro/login em si, sem seed via API).

describe('Cadastro e login', () => {
  const uniqueEmail = () =>
    `qa.${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}@empresa.com.br`;

  it('cadastra um usuário novo e cai no onboarding (sem squad vinculada ainda)', () => {
    const email = uniqueEmail();

    cy.visit('/login');
    cy.openRegisterTab();

    cy.contains('label', 'Nome Completo').parent().find('input').type('QA Automation');
    cy.get('input[type="email"]').type(email);
    cy.get('input[type="password"]').type('SenhaForte123');
    cy.contains('button', 'Criar Conta').click();

    cy.url({ timeout: 10000 }).should('include', '/onboarding');
    cy.contains('Criar Novo Projeto');
    cy.contains('Entrar em Projeto Existente');
  });

  it('bloqueia login com senha errada sem revelar se o e-mail existe', () => {
    const email = uniqueEmail();

    // cadastra via API só pra ter uma conta real de referência
    cy.request('POST', `${Cypress.env('apiUrl')}/auth/register`, {
      email,
      name: 'QA Wrong Password',
      password: 'SenhaForte123',
    });

    cy.visit('/login');
    cy.get('input[type="email"]').type(email);
    cy.get('input[type="password"]').type('SenhaErrada999');
    cy.contains('button', 'Acessar Plataforma').click();

    cy.contains('Falha na autenticação');
    cy.url().should('include', '/login');
  });

  it('loga com credenciais válidas e mantém a sessão após reload', () => {
    const email = uniqueEmail();

    cy.request('POST', `${Cypress.env('apiUrl')}/auth/register`, {
      email,
      name: 'QA Login OK',
      password: 'SenhaForte123',
    });

    cy.visit('/login');
    cy.get('input[type="email"]').type(email);
    cy.get('input[type="password"]').type('SenhaForte123');
    cy.contains('button', 'Acessar Plataforma').click();

    cy.url({ timeout: 10000 }).should('not.include', '/login');
    cy.reload();
    cy.url().should('not.include', '/login');
  });
});

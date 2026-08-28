describe('Smoke Test - Espaço Ágil', () => {
  it('Deve carregar a página inicial corretamente', () => {
    // Acessa a raiz configurada no baseUrl
    cy.visit('/');
    
    // Verifica se a página renderizou procurando pelo título ou um elemento chave
    cy.get('body').should('be.visible');
    cy.title().should('not.be.empty');
  });

  it('Deve ter a navegação para o Changelog disponível', () => {
    cy.visit('/');
    
    // Procura por um link que leve para a página de changelog
    cy.get('a[href*="/changelog"]').should('exist');
  });
});

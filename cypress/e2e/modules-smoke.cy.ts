// Fluxo 6 do plano de testes: smoke por módulo. Não testa interação profunda de cada módulo
// (isso fica pro checklist manual + specs dedicados que forem sendo adicionados) — garante que,
// com uma squad de verdade vinculada (seedUserWithProject, ver cypress/support/commands.ts),
// cada rota principal carrega sem esbarrar no onboarding, no login, ou numa exceção não tratada.
// Admin fica de fora daqui de propósito: exige usuário com role=ADMIN (tier de sistema), que só
// se promove manualmente por SQL — ver docs/testing/qa-checklist-producao.md item 1.

const MODULE_ROUTES: Array<{ name: string; path: string }> = [
  { name: 'Squad', path: '/squad' },
  { name: 'Scrum Poker', path: '/room' },
  { name: 'Retrospectiva', path: '/retro' },
  { name: 'Review (Showcase)', path: '/showcase' },
  { name: 'JiraDash', path: '/jiradash' },
  { name: 'Planejador (Sprint Planner)', path: '/sprint-planner' },
  { name: 'Plano de Ação', path: '/action-plan' },
  { name: 'Base de Conhecimento', path: '/knowledge' },
  { name: 'Biblioteca de IA (Prompt Hub)', path: '/prompt-hub' },
];

describe('Smoke dos módulos principais (usuário com squad vinculada)', () => {
  MODULE_ROUTES.forEach(({ name, path }) => {
    it(`${name} (${path}) carrega sem redirecionar pro onboarding/login`, () => {
      cy.seedUserWithProject().then((session) => {
        cy.loginAsSeededSession(session, path);

        cy.location('pathname', { timeout: 10000 }).should((pathname) => {
          expect(pathname).not.to.include('/onboarding');
          expect(pathname).not.to.include('/login');
        });

        cy.get('body').should('be.visible');
      });
    });
  });
});

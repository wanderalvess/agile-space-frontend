// Fluxo 4 do plano de testes: agilista com papel de liderança transversal (Tribe Lead / Agile
// Coach / People Lead) enxerga automaticamente todas as squads da mesma tribo, mesmo sem
// atribuição direta nelas (UserProjectResolverService.resolveUserAccess). Como não existe
// endpoint público pra criar ProjectMemberRole (só vem do sync Profields do Jira ou de um admin),
// semeia via SQL direto — mesmo padrão de cypress/e2e/onboarding-claim-account.cy.ts.
//
// Roda a nível de API (sem UI) de propósito: valida o contrato real de acesso multi-squad, que é
// a parte que importa aqui — o seletor de projeto na UI já é coberto indiretamente pelos outros
// specs que usam seedUserWithProject.

describe('Acesso multi-squad de liderança transversal (Tribe Lead)', () => {
  it('Tribe Lead com papel direto em 1 projeto enxerga e troca pra outro projeto da mesma tribo sem atribuição direta', () => {
    const unique = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const email = `qa.tribelead.${unique}@empresa.com.br`;
    const tribe = `Tribo QA ${unique}`;
    const projectA = `QATLA${unique}`.toUpperCase();
    const projectB = `QATLB${unique}`.toUpperCase();

    cy.request('POST', `${Cypress.env('apiUrl')}/auth/register`, {
      email,
      name: 'QA Tribe Lead',
      password: 'SenhaForte123',
    }).then((registerRes) => {
      const token = registerRes.body.token as string;

      cy.psql(
        `INSERT INTO projects (id, name, tribe_name) VALUES ` +
          `('${projectA}', 'Projeto A QA', '${tribe}'), ('${projectB}', 'Projeto B QA', '${tribe}');`
      );
      cy.psql(
        `INSERT INTO project_member_roles (id, project_id, role_name, role_key, display_name, email, is_leadership) ` +
          `VALUES ('pmr-${unique}', '${projectA}', 'Tribe Lead', 'TRIBE_LEAD', 'QA Tribe Lead', '${email}', true);`
      );

      cy.request({
        method: 'GET',
        url: `${Cypress.env('apiUrl')}/auth/me`,
        headers: { Authorization: `Bearer ${token}` },
      }).then((meRes) => {
        const projectIds = (meRes.body.accessibleProjects || []).map((p: any) => p.projectId);
        expect(projectIds, 'enxerga o projeto com atribuição direta').to.include(projectA);
        expect(projectIds, 'enxerga o projeto B só pela expansão de tribo').to.include(projectB);
      });

      cy.request({
        method: 'POST',
        url: `${Cypress.env('apiUrl')}/auth/switch-project?projectId=${projectB}`,
        headers: { Authorization: `Bearer ${token}` },
      }).then((switchRes) => {
        expect(switchRes.status).to.eq(200);
        expect(switchRes.body.activeProjectId).to.eq(projectB);
      });
    });
  });

  it('usuário comum (sem liderança) não consegue trocar pra um projeto fora do seu acesso', () => {
    const unique = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const email = `qa.member.${unique}@empresa.com.br`;
    const foreignProject = `QAFOREIGN${unique}`.toUpperCase();

    cy.psql(`INSERT INTO projects (id, name) VALUES ('${foreignProject}', 'Projeto Alheio QA');`);

    cy.request('POST', `${Cypress.env('apiUrl')}/auth/register`, {
      email,
      name: 'QA Member',
      password: 'SenhaForte123',
    }).then((registerRes) => {
      const token = registerRes.body.token as string;

      cy.request({
        method: 'POST',
        url: `${Cypress.env('apiUrl')}/auth/switch-project?projectId=${foreignProject}`,
        headers: { Authorization: `Bearer ${token}` },
        failOnStatusCode: false,
      }).then((switchRes) => {
        expect(switchRes.status).to.eq(403);
      });
    });
  });
});

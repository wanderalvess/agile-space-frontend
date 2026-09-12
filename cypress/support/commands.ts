/// <reference types="cypress" />

const TOKEN_STORAGE_KEY = 'agileSpace_auth_token';

export interface SeededSession {
  token: string;
  userId: string;
  email: string;
  projectId: string;
}

/**
 * Cadastra um usuário novo direto na API (sem passar pela UI) e cria um projeto manual pra ele
 * via POST /api/projects — o mesmo endpoint do card "Criar Novo Projeto" do onboarding. Não
 * depende de Jira: é a forma mais rápida de ter uma squad + usuário com papel de Agile Master
 * pra testar os módulos que exigem squad vinculada.
 */
Cypress.Commands.add('seedUserWithProject', (overrides: Partial<{ name: string; projectId: string }> = {}) => {
  const unique = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const email = `qa.${unique}@empresa.com.br`;
  const projectId = (overrides.projectId || `QA${unique}`).toUpperCase();

  return cy
    .request('POST', `${Cypress.env('apiUrl')}/auth/register`, {
      email,
      name: overrides.name || 'QA Automation',
      password: 'SenhaForte123',
    })
    .then((registerRes) => {
      const token = registerRes.body.token as string;
      const userId = registerRes.body.id as string;

      return cy
        .request({
          method: 'POST',
          url: `${Cypress.env('apiUrl')}/projects`,
          headers: { Authorization: `Bearer ${token}` },
          body: { id: projectId, name: `Squad QA ${unique}` },
        })
        .then((projectRes) => {
          const session: SeededSession = {
            token: projectRes.body.token as string,
            userId,
            email,
            projectId,
          };
          return session;
        });
    });
});

/**
 * Injeta uma sessão já autenticada no localStorage (mesma chave usada por auth-client.ts) antes
 * de visitar a página — evita repetir o formulário de login em specs que só precisam de um
 * usuário logado pra testar outra coisa.
 */
Cypress.Commands.add('loginAsSeededSession', (session: SeededSession, path: string = '/') => {
  cy.visit(path, {
    onBeforeLoad(win) {
      win.localStorage.setItem(TOKEN_STORAGE_KEY, session.token);
    },
  });
});

const DB_CONTAINER = 'agile-space-db';

/**
 * Roda um comando SQL direto no Postgres do docker-compose local (container `agile-space-db`).
 * Usado só pra semear estado que hoje não tem endpoint público (conta pré-provisionada pelo
 * sync do Jira, ProjectMemberRole de liderança) — ver specs de claim-account e multi-squad.
 * Requer `docker` no PATH e o container rodando; falha alto e claro se não achar.
 */
Cypress.Commands.add('psql', (sql: string) => {
  const escaped = sql.replace(/"/g, '\\"');
  return cy.exec(`docker exec ${DB_CONTAINER} psql -U postgres -d espacoagil -c "${escaped}"`, {
    failOnNonZeroExit: true,
  });
});

// O root layout dispara "Hydration failed" (ver cypress/support/e2e.ts) em toda primeira
// renderização — o React recupera sozinho re-montando a árvore inteira do zero logo em seguida,
// o que pode "engolir" um clique feito cedo demais na árvore antiga prestes a ser descartada.
// Uma pequena espera após cada visit reduz a janela de risco, mas sozinha não é 100% confiável
// sob carga (ver openRegisterTab abaixo pra quem clica algo logo após o visit).
Cypress.Commands.overwrite('visit', ((originalFn: any, ...args: any[]) => {
  originalFn(...args);
  return cy.wait(800);
}) as any);

/**
 * Clica na aba "Cadastrar" da tela de login e reclica se a re-montagem pós-hydration (ver acima)
 * "engoliu" o primeiro clique — mais robusto que confiar num tempo fixo de espera.
 */
Cypress.Commands.add('openRegisterTab', (attemptsLeft = 8) => {
  cy.contains('button', 'Cadastrar').click();
  cy.get('body').then(($body) => {
    if ($body.find('label:contains("Nome Completo")').length === 0 && attemptsLeft > 0) {
      cy.wait(300);
      cy.openRegisterTab(attemptsLeft - 1);
    }
  });
});

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Cypress {
    interface Chainable {
      seedUserWithProject(
        overrides?: Partial<{ name: string; projectId: string }>
      ): Chainable<SeededSession>;
      loginAsSeededSession(session: SeededSession, path?: string): Chainable<void>;
      psql(sql: string): Chainable<Cypress.Exec>;
      openRegisterTab(attemptsLeft?: number): Chainable<void>;
    }
  }
}

export {};

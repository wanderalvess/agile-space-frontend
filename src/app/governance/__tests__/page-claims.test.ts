import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(join(__dirname, '..', 'page.tsx'), 'utf8');

// A página de governança é texto fixo: estas frases já foram desmentidas pelo código e não podem voltar.
describe('/governance não afirma o que o código contradiz', () => {
  it('não diz que não há migrations', () => {
    expect(source).not.toMatch(/Sem migrations manuais/);
    expect(source).toMatch(/Flyway/);
  });

  it('não diz que o token do Jira é só do dono', () => {
    expect(source).not.toMatch(/Somente o usuário dono/);
    expect(source).toMatch(/administradores/);
  });

  it('não promete login com Google como "em desenvolvimento"', () => {
    expect(source).not.toMatch(/Google Workspace está em desenvolvimento/);
  });

  it('não usa número de versão de política inventado', () => {
    expect(source).not.toMatch(/Política v3\.0/);
  });
});

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const dir = join(__dirname, '..');
const read = (f: string) => readFileSync(join(dir, f), 'utf8');
// A página é texto fixo vindo de content.ts: estas frases já foram desmentidas pelo código e não podem voltar.
const source = [read('content.ts'), read('GovernanceContent.tsx'), read('page.tsx'), read('GovernanceGuideSheet.tsx')].join('\n');

describe('/governance não afirma o que o código contradiz', () => {
  it('não diz que o token dura 24 horas como sessão fixa nem que não há logout', () => {
    expect(source).not.toMatch(/token de 24 horas/i);
    expect(source).not.toMatch(/não há logout/i);
    expect(source).not.toMatch(/Não há logout nem refresh/i);
  });

  it('descreve a sessão renovável e o Sair que encerra em todos os aparelhos', () => {
    expect(source).toMatch(/por até 7 dias/);
    expect(source).toMatch(/em todos os aparelhos/);
  });

  it('não chama o Cofre de "cofre no PostgreSQL": o Cofre do DevTools fica só no navegador', () => {
    expect(source).not.toMatch(/cofre de segredos.*postgres/i);
    expect(source).not.toMatch(/Cofre.*PostgreSQL/i);
    expect(source).toMatch(/Só neste navegador, nunca no servidor/);
  });

  it('não diz que o administrador vê o token do Jira', () => {
    expect(source).not.toMatch(/Usuário dono e administradores/);
    expect(source).not.toMatch(/administradores?\s+(veem|vê|pode ver|recebem)\s+o\s+token/i);
    expect(source).toMatch(/nunca o token/);
  });

  it('não promete o que o sistema não tem', () => {
    expect(source).not.toMatch(/Login com Google/i);
    expect(source).not.toMatch(/Google Workspace está em desenvolvimento/);
    expect(source).not.toMatch(/Política v3\.0/);
    expect(source).not.toMatch(/não (são )?utilizad[ao]s? para treinar/i);
    expect(source).not.toMatch(/TLS 1\.3/);
    expect(source).not.toMatch(/conformidade LGPD/i);
  });

  it('não repete palavras e estilos proibidos', () => {
    expect(source).not.toMatch(/engenharia/i);
    expect(source).not.toMatch(/\bitalic\b|\bfont-black\b|\buppercase\b/);
  });

  it('retenção: sem prazo inventado', () => {
    expect(source).toMatch(/Sem prazo definido ainda/);
    expect(source).not.toMatch(/reten[cç][aã]o de \d+/i);
  });

  it('o botão "Editar texto" não existe (não há armazenamento para o texto editável)', () => {
    expect(source).not.toMatch(/Editar texto/);
  });
});

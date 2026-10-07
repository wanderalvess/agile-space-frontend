import { generateDelphiClasses, generateJavaClasses, generateTypeScriptInterfaces } from '../generators';

const json = JSON.stringify({ id: 1, nota: 2.5, tarefas: [{ chave: 'A' }], dono: { nome: 'x' } });

describe('type-generator', () => {
  it('typescript', () => {
    const out = generateTypeScriptInterfaces(json);
    expect(out).toContain('export interface Root');
    expect(out).toContain('tarefas: Tarefa[];');
    expect(out).toContain('export interface Dono');
  });
  it('java', () => {
    const out = generateJavaClasses(json);
    expect(out).toContain('private Integer id;');
    expect(out).toContain('private Double nota;');
    expect(out).toContain('List<Tarefa>');
  });
  it('delphi usa TRoot (sem T duplo)', () => {
    const out = generateDelphiClasses(json);
    expect(out).toContain('TRoot = class');
    expect(out).not.toContain('TTRoot');
  });
  it('JSON inválido lança erro', () => {
    expect(() => generateTypeScriptInterfaces('{x')).toThrow();
  });
});

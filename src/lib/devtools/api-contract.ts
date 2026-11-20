/**
 * Contrato de API: compara a resposta esperada com a recebida (primeiro nível) e gera asserções.
 * O código veio da antiga ferramenta "Diff de API"; o comportamento é o mesmo.
 */

export type Framework = 'postman' | 'cypress' | 'playwright';

export interface DiffItem {
  kind: 'missing' | 'changed' | 'added' | 'same';
  text: string;
}

export const SAMPLE_EXPECTED = `{\n  "status": "success",\n  "code": 200,\n  "data": {\n    "id": "USR-101",\n    "name": "Ana Silva",\n    "role": "QA Lead"\n  }\n}`;
export const SAMPLE_ACTUAL = `{\n  "status": "success",\n  "code": 200,\n  "data": {\n    "id": "USR-101",\n    "name": "Ana Silva",\n    "role": "QA Engineer",\n    "newField": true\n  }\n}`;
export const SAMPLE_PAYLOAD = `{\n  "id": "USR-999",\n  "active": true,\n  "items": ["item1", "item2"]\n}`;

// Comparação de primeiro nível, igual à ferramenta antiga.
export function compareJson(expected: string, actual: string): { items: DiffItem[]; error: string | null } {
  try {
    const obj1 = JSON.parse(expected);
    const obj2 = JSON.parse(actual);
    const items: DiffItem[] = [];
    Object.keys(obj1).forEach((k) => {
      if (!(k in obj2)) items.push({ kind: 'missing', text: `Campo ausente na resposta atual: "${k}"` });
      else if (JSON.stringify(obj1[k]) !== JSON.stringify(obj2[k])) {
        items.push({ kind: 'changed', text: `Divergência no valor da chave "${k}": esperado ${JSON.stringify(obj1[k])} vs atual ${JSON.stringify(obj2[k])}` });
      }
    });
    Object.keys(obj2).forEach((k) => {
      if (!(k in obj1)) items.push({ kind: 'added', text: `Campo novo na resposta atual: "${k}" (valor: ${JSON.stringify(obj2[k])})` });
    });
    if (items.length === 0) items.push({ kind: 'same', text: 'Os JSONs são idênticos em estrutura e valores de primeiro nível.' });
    return { items, error: null };
  } catch {
    return { items: [], error: 'JSON inválido: verifique se os dois textos estão em formato JSON válido.' };
  }
}

export function generateAssertions(payload: string, framework: Framework): { text: string; error: string | null } {
  try {
    const obj = JSON.parse(payload);
    const lines: string[] = [];
    if (framework === 'postman') {
      lines.push('// Testes de Asserção - Postman / Newman');
      lines.push('pm.test("Status code é 200", function () {');
      lines.push('    pm.response.to.have.status(200);');
      lines.push('});');
      lines.push('');
      lines.push('const responseData = pm.response.json();');
      Object.entries(obj).forEach(([key, val]) => {
        if (typeof val === 'string') {
          lines.push(`pm.test("Campo ${key} é string válida", function () {`);
          lines.push(`    pm.expect(responseData.${key}).to.be.a('string');`);
          lines.push(`});`);
        } else if (typeof val === 'boolean') {
          lines.push(`pm.test("Campo ${key} é booleano", function () {`);
          lines.push(`    pm.expect(responseData.${key}).to.be.a('boolean');`);
          lines.push(`});`);
        } else if (Array.isArray(val)) {
          lines.push(`pm.test("Campo ${key} é array", function () {`);
          lines.push(`    pm.expect(responseData.${key}).to.be.an('array');`);
          lines.push(`});`);
        }
      });
    } else if (framework === 'cypress') {
      lines.push('// Asserções para Cypress API (cy.request)');
      lines.push('cy.request("GET", "/api/endpoint").then((response) => {');
      lines.push('  expect(response.status).to.eq(200);');
      Object.keys(obj).forEach((key) => lines.push(`  expect(response.body).to.have.property('${key}');`));
      lines.push('});');
    } else {
      lines.push('// Asserções para Playwright API Testing (request.get)');
      lines.push('const response = await request.get("/api/endpoint");');
      lines.push('expect(response.status()).toBe(200);');
      lines.push('const body = await response.json();');
      Object.keys(obj).forEach((key) => lines.push(`expect(body).toHaveProperty('${key}');`));
    }
    return { text: lines.join('\n'), error: null };
  } catch {
    return { text: '', error: 'JSON inválido: insira um payload JSON válido para gerar as asserções.' };
  }
}

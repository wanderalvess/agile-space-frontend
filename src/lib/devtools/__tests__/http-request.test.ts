import { describe, expect, it } from 'vitest';
import { buildUrl, generateSnippet, parseCurl, shellTokenize } from '../http-request';

describe('http-request', () => {
  it('tokeniza aspas e continuação de linha', () => {
    expect(shellTokenize(`curl -H 'A: b c' \\\n "x y"`)).toEqual(['curl', '-H', 'A: b c', 'x y']);
  });
  it('parseia cURL com header, corpo e query', () => {
    const r = parseCurl(`curl -X POST 'https://api.ex.com/v1/a?x=1&y=2' -H 'Content-Type: application/json' -d '{"a":1}'`)!;
    expect(r.method).toBe('POST');
    expect(r.url).toBe('https://api.ex.com/v1/a');
    expect(r.params.map(p => [p.key, p.value])).toEqual([['x', '1'], ['y', '2']]);
    expect(r.headers[0].key).toBe('Content-Type');
    expect(JSON.parse(r.body)).toEqual({ a: 1 });
  });
  it('-d sem -X vira POST; sem URL devolve null', () => {
    expect(parseCurl(`curl https://a.com -d x=1`)!.method).toBe('POST');
    expect(parseCurl('curl -s')).toBeNull();
  });
  it('monta URL com params', () => {
    expect(buildUrl('https://a.com?z=1', [{ id: '1', key: 'a', value: 'b c' }])).toBe('https://a.com?z=1&a=b+c');
  });
  it('gera snippets', () => {
    const m = { method: 'POST', url: 'https://a.com', headers: { A: 'b' }, body: '{"a":1}' };
    expect(generateSnippet('curl', m)).toContain(`-d '{"a":1}'`);
    expect(generateSnippet('fetch', m)).toContain('JSON.stringify(');
    expect(generateSnippet('java', m)).toContain('BodyPublishers.ofString');
    expect(generateSnippet('python', m)).toContain('requests.request("POST", url, headers=headers, data=payload)');
  });
});

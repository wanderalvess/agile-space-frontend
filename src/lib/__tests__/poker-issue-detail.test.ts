import { describe, it, expect } from 'vitest';
import type { Issue } from '../types';
import { issueToDetail, looksLikeHtml, plainTextToHtml, originOf, renderIssueRichText } from '../poker-issue-detail';

describe('issueToDetail', () => {
  it('leva os campos do Jira e o link (vazio vira indefinido)', () => {
    const issue = { id: '1', key: 'PTV-1', title: 'Título', jiraLink: '', status: 'pending', estimatedPoints: null, description: 'd', jiraType: 'Bug', jiraLabels: ['x'] } as Issue;
    expect(issueToDetail(issue)).toMatchObject({ key: 'PTV-1', summary: 'Título', description: 'd', type: 'Bug', labels: ['x'], link: undefined });
    expect(issueToDetail({ ...issue, key: null }).key).toBe('');
  });
});

describe('texto', () => {
  it('distingue HTML de texto com sinal de menor', () => {
    expect(looksLikeHtml('<p>oi</p>')).toBe(true);
    expect(looksLikeHtml('use <br/> aqui')).toBe(true);
    expect(looksLikeHtml('se a < b e c > d')).toBe(false);
  });
  it('texto puro vira parágrafos e preserva a quebra de linha', () => {
    expect(plainTextToHtml('Dado A\nQuando B\n\nEntão C')).toBe('<p>Dado A<br>Quando B</p><p>Então C</p>');
    expect(plainTextToHtml('<script>x</script>')).toBe('<p>&lt;script&gt;x&lt;/script&gt;</p>');
  });
  it('origem só de http(s)', () => {
    expect(originOf('https://jira.x.com/browse/A-1')).toBe('https://jira.x.com');
    expect(originOf('javascript:alert(1)')).toBeUndefined();
    expect(originOf(undefined)).toBeUndefined();
  });
});

describe('renderIssueRichText', () => {
  it('vazio devolve vazio', () => {
    expect(renderIssueRichText('  ')).toBe('');
  });
  it('mantém as quebras do texto puro', () => {
    const html = renderIssueRichText('linha 1\nlinha 2');
    expect(html).toContain('<br>');
    expect(html).toContain('linha 2');
  });
  it('remove script e handlers do HTML do Jira', () => {
    const html = renderIssueRichText('<p onclick="x()">ok</p><script>alert(1)</script><img src="x" onerror="alert(1)">');
    expect(html).not.toContain('script');
    expect(html).not.toContain('onerror');
    expect(html).not.toContain('onclick');
  });
  it('links abrem em nova aba e caminhos relativos ganham a origem do Jira', () => {
    const html = renderIssueRichText('<a href="/browse/A-2">outra</a> <img src="/secure/attachment/1/a.png">', 'https://jira.x.com/browse/A-1');
    expect(html).toContain('href="https://jira.x.com/browse/A-2"');
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
  });
  it('imagem do Jira vira link; imagem de outro site continua imagem', () => {
    const html = renderIssueRichText('<img src="/secure/attachment/1/a.png" alt="print"><img src="https://cdn.x.com/b.png">', 'https://jira.x.com/browse/A-1');
    expect(html).toContain('<a href="https://jira.x.com/secure/attachment/1/a.png"');
    expect(html).toContain('>print</a>');
    expect(html).toContain('<img src="https://cdn.x.com/b.png">');
  });
});

import { describe, expect, it } from 'vitest';
import { allowTlsFallback, clientKey, isAllowedJiraPath, isTlsTrustError } from '../jira-proxy';

describe('proxy do Jira', () => {
  it('aceita só os caminhos de leitura usados pelo JiraDash', () => {
    expect(isAllowedJiraPath('/rest/api/2/search?jql=a')).toBe(true);
    expect(isAllowedJiraPath('/rest/api/2/field')).toBe(true);
    expect(isAllowedJiraPath('/rest/api/2/issue/ABC-12/worklog?maxResults=5000')).toBe(true);
    expect(isAllowedJiraPath('/rest/agile/1.0/sprint/123')).toBe(true);
  });

  it('recusa outros endpoints, travessia e host embutido', () => {
    expect(isAllowedJiraPath('/rest/api/2/user')).toBe(false);
    expect(isAllowedJiraPath('/rest/api/2/issue/ABC-12')).toBe(false);
    expect(isAllowedJiraPath('//evil.com/rest/api/2/search')).toBe(false);
    expect(isAllowedJiraPath('/rest/api/2/searchx')).toBe(false);
    expect(isAllowedJiraPath('/x/../rest/api/2/search')).toBe(false);
  });

  it('só erro de confiança TLS libera a segunda tentativa', () => {
    expect(isTlsTrustError({ code: 'SELF_SIGNED_CERT_IN_CHAIN' })).toBe(true);
    expect(isTlsTrustError({ code: 'UNABLE_TO_VERIFY_LEAF_SIGNATURE' })).toBe(true);
    expect(isTlsTrustError({ code: 'ECONNREFUSED' })).toBe(false);
    expect(isTlsTrustError(new Error('x'))).toBe(false);
    expect(isTlsTrustError(null)).toBe(false);
  });

  it('JIRA_TLS_INSECURE=0 desliga o fallback; outros valores mantêm', () => {
    expect(allowTlsFallback('0')).toBe(false);
    expect(allowTlsFallback('false')).toBe(true);
    expect(allowTlsFallback(undefined)).toBe(true);
  });

  it('identifica o cliente pelo primeiro IP encaminhado', () => {
    const h = (m: Record<string, string>) => ({ get: (k: string) => m[k] ?? null });
    expect(clientKey(h({ 'x-forwarded-for': '1.2.3.4, 10.0.0.1' }))).toBe('1.2.3.4');
    expect(clientKey(h({ 'x-real-ip': '5.6.7.8' }))).toBe('5.6.7.8');
    expect(clientKey(h({}))).toBe('local-client');
  });
});

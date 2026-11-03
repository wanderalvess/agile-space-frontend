import { describe, expect, it } from 'vitest';
import { upstreamErrorMessage } from '../jira-proxy-error';

const FALLBACK = 'Erro ao buscar no Jira via Spring Boot';

describe('upstreamErrorMessage', () => {
  it('usa o error do backend (token recusado) em vez do texto genérico', () => {
    const body = JSON.stringify({ error: 'O Jira não reconheceu o token. Confira se o PAT existe.' });
    expect(upstreamErrorMessage(body, FALLBACK)).toBe('O Jira não reconheceu o token. Confira se o PAT existe.');
  });

  it('sem error, usa a primeira errorMessages do Jira (JQL inválida)', () => {
    const body = JSON.stringify({ errorMessages: ['', "Error in the JQL Query: ';' not expected"], errors: {} });
    expect(upstreamErrorMessage(body, FALLBACK)).toBe("Error in the JQL Query: ';' not expected");
  });

  it('corpo que não é JSON (HTML do WAF) cai no texto genérico', () => {
    expect(upstreamErrorMessage('<html><title>Blocked</title></html>', FALLBACK)).toBe(FALLBACK);
  });

  it('corpo vazio ou sem mensagem útil cai no texto genérico', () => {
    expect(upstreamErrorMessage('', FALLBACK)).toBe(FALLBACK);
    expect(upstreamErrorMessage('{}', FALLBACK)).toBe(FALLBACK);
    expect(upstreamErrorMessage(JSON.stringify({ error: '   ', errorMessages: [] }), FALLBACK)).toBe(FALLBACK);
  });
});

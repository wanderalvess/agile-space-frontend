/**
 * Sinal de "acabou de criar a conta". O backend vincula quem se cadastra ao time pelo e-mail
 * (AuthService.register); o frontend usa este sinal para mandar a pessoa ao Painel do time e
 * explicar o vínculo uma vez, em vez de largá-la na home sem contexto.
 *
 * O sinal é gravado ANTES do cadastro (não dá para depender da ordem entre o fim do `register`
 * e o redirecionamento do AuthGuard) e apagado se o cadastro falhar ou quando a pessoa dispensa o aviso.
 */

const KEY = 'agileSpace_justSignedUp';

export function markJustSignedUp(): void {
  try {
    localStorage.setItem(KEY, '1');
  } catch {
    /* storage bloqueado: só perde o aviso */
  }
}

export function clearJustSignedUp(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignora */
  }
}

export function isJustSignedUp(): boolean {
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

/** True quando a conta tem um time de verdade (não vazio, não o placeholder de quem ainda não tem time). */
export function hasLinkedTeam(projectId?: string | null): boolean {
  const id = (projectId || '').trim();
  return id.length > 0 && id !== 'Sem Time';
}

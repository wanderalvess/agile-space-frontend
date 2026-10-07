/**
 * Sinal de "acabou de criar a conta". O backend vincula quem se cadastra ao time pelo e-mail
 * (AuthService.register); o frontend usa este sinal para mandar a pessoa ao Painel do time e
 * explicar o vínculo uma vez, em vez de largá-la na home sem contexto.
 *
 * O sinal é gravado ANTES do cadastro (não dá para depender da ordem entre o fim do `register`
 * e o redirecionamento do AuthGuard) e apagado se o cadastro falhar ou quando a pessoa dispensa o aviso.
 */

const KEY = 'agileSpace_justSignedUp';
// O sinal expira: se o cadastro der certo mas a pessoa nunca chegar ao aviso (ex.: sem time vinculado), ele não
// pode sobrar no navegador e disparar "você já está no time X" no próximo login, seja dela ou de outra pessoa.
export const JUST_SIGNED_UP_TTL_MS = 10 * 60 * 1000;

export function markJustSignedUp(): void {
  try {
    localStorage.setItem(KEY, String(Date.now()));
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
    const at = Number(localStorage.getItem(KEY));
    if (!Number.isFinite(at) || at <= 0) return false;
    if (Date.now() - at > JUST_SIGNED_UP_TTL_MS) {
      localStorage.removeItem(KEY);
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

/** True quando a conta tem um time de verdade (não vazio, não o placeholder de quem ainda não tem time). */
export function hasLinkedTeam(projectId?: string | null): boolean {
  const id = (projectId || '').trim();
  return id.length > 0 && id !== 'Sem Time';
}

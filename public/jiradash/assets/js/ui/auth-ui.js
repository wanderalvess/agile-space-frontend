// UI de status do token. Lê `auth` e escreve no `#auth-status` via `dom`.
//
// ⚠️ Os template literals deste módulo têm indentação SIGNIFICATIVA: o espaço das
// linhas internas faz parte do valor da string. Não reindente o interior deles.
import { dom } from '../platform/dom.js';
import { auth } from '../platform/auth.js';

export const authUI = {
  render() {
    const el = dom.authStatus;
    if (!el) return;
    // Mantém o campo do PAT sincronizado com o token guardado.
    const input = dom.patInput;
    if (input && input.value !== auth.token) input.value = auth.token;

    if (auth.authenticated) {
      el.innerHTML = `<div class="auth-status-row">
              <span class="auth-status-ok">✓ Token configurado</span>
              <button class="btn btn-sm" type="button" data-action="clear-pat">Limpar token</button>
            </div>`;
    } else {
      el.innerHTML = `<div class="auth-status-row">
              <span>Nenhum token configurado. Cole seu PAT do Jira abaixo.</span>
            </div>`;
    }
  }
};

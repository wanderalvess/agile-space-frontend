// PAT do Jira: leitura, gravação e limpeza do token.
// Getters/setters e o uso de `this` são preservados como estavam.

// PAT vive em sessionStorage: apaga quando a aba/janela fecha.
// Evita o vazamento persistente que o localStorage causa (XSS, máquina compartilhada,
// extensões de browser, backup de perfil). Refresh (F5) mantém; nova aba não.
// Autenticação é via Personal Access Token (PAT) do Jira: o token fica em
// sessionStorage e é enviado no header x-jira-token das chamadas ao proxy
// /jira (o proxy injeta a credencial real no Jira). Sem OAuth / sessão no servidor.
export const auth = {
  get token() {
    return sessionStorage.getItem('jira-pat') || '';
  },
  set token(value) {
    const clean = String(value || '').trim();
    if (clean) sessionStorage.setItem('jira-pat', clean);
    else sessionStorage.removeItem('jira-pat');
  },
  get authenticated() {
    return Boolean(this.token);
  },
  clear() {
    sessionStorage.removeItem('jira-pat');
  },
  // Remove tokens legados que versões antigas guardavam por squad / em localStorage.
  // Também apaga o 'squad-members': ele acumulava ex-membros pra sempre e fazia o roster
  // variar de máquina pra máquina. Substituído pelo board do Jira ('sprint-boards').
  purgeLegacy() {
    try {
      localStorage.removeItem('jira-token');
      localStorage.removeItem('squad-members');
      const squads = JSON.parse(localStorage.getItem('squads') || '[]');
      let changed = false;
      for (const squad of squads) {
        if (squad?.token) {
          delete squad.token;
          changed = true;
        }
      }
      if (changed) localStorage.setItem('squads', JSON.stringify(squads));
    } catch {
      /* storage inválido — ignora */
    }
  }
};

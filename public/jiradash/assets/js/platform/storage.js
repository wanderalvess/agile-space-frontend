// Wrapper de localStorage. getJson é fail-soft de propósito: JSON inválido devolve o
// fallback em vez de estourar, porque storage corrompido não pode derrubar o dashboard.
// Não toca o storage na avaliação — só dentro dos métodos.

export const storage = {
  getJson(key, fallback) {
    try {
      return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback));
    } catch {
      return fallback;
    }
  },
  setJson(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  },
  get(key) {
    return localStorage.getItem(key);
  },
  set(key, value) {
    localStorage.setItem(key, value);
  },
  remove(key) {
    localStorage.removeItem(key);
  }
};

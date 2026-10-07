// Acesso ao documento: os dois seletores e o Proxy `dom`.
//
// `selectors` fica PRIVADO ao módulo — o mapa de IDs é detalhe de implementação, e quem
// precisa de um elemento usa `dom.<chave>`. O Proxy consulta o documento SOMENTE no get, o
// que mantém a avaliação do módulo livre de DOM: nada é buscado na carga.

const selectors = {
  dashboard: '#dashboard',
  configPanel: '#config-panel',
  errorArea: '#error-area',
  warningArea: '#warning-area',
  loadingArea: '#loading-area',
  metricsGrid: '#metrics-grid',
  sprintInfo: '#sprint-info',
  squadTabs: '#squad-tabs',
  dashTitle: '#dash-title',
  dashSub: '#dash-sub',
  authStatus: '#auth-status',
  jqlInput: '#jql-input',
  patInput: '#pat-input'
};

export const $ = (selector, root = document) => root.querySelector(selector);
export const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

export const dom = new Proxy(
  {},
  {
    get(_, key) {
      const selector = selectors[key];
      if (!selector) {
        console.warn(`[dom] Chave desconhecida: "${key}"`);
        return null;
      }
      return $(selector);
    }
  }
);

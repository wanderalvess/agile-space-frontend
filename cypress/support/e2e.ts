import './commands';

// O root layout injeta um <script> inline (tema salvo no localStorage) direto no <head>, ao lado
// de metatags gerenciadas pelo App Router. Isso dispara um "Hydration failed" no overlay de dev
// do Next 16 já no primeiro load de qualquer página — o próprio React recupera sozinho
// ("tree will be regenerated on the client"), não afeta usuário real nem build de produção, mas
// o overlay de dev transforma isso numa exceção não tratada que o Cypress trata como falha fatal.
// Ignora só essa mensagem específica — qualquer outra exceção não tratada continua derrubando o teste.
Cypress.on('uncaught:exception', (err) => {
  if (err.message.includes('Hydration failed because the server rendered HTML')) {
    return false;
  }
});

// Hide fetch/XHR requests from command log
const app = window.top;
if (app && !app.document.head.querySelector('[data-hide-command-log-request]')) {
  const style = app.document.createElement('style');
  style.innerHTML =
    '.command-name-request, .command-name-xhr { display: none }';
  style.setAttribute('data-hide-command-log-request', '');
  app.document.head.appendChild(style);
}

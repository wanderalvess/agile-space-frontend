// UI comum do dashboard: mensagens, visibilidade de painéis e o cartão de métrica.
//
// SEGURANÇA: `renderMetric` interpola `value` e `sub` como HTML cru, porque alguns callers
// passam `<span>` embutido; `label` passa por `escapeHtml` e o `actionId` de `showWarning`
// por `escapeAttr`. Os template literals têm whitespace significativo — não reindente o
// interior deles.
//
// Não toca o DOM na avaliação: os nós são resolvidos via `dom` dentro dos métodos.
import { escapeHtml, escapeAttr } from '../core/helpers.js';
import { dom } from '../platform/dom.js';

export const ui = {
  setHidden(element, hidden) {
    if (element) element.hidden = hidden;
  },
  showError(message) {
    dom.errorArea.innerHTML = `<div class="error-msg">⚠️ ${escapeHtml(message)}</div>`;
  },
  clearError() {
    dom.errorArea.innerHTML = '';
  },
  showWarning({ message, actionLabel, actionId } = {}) {
    if (!message) return;
    const button =
      actionLabel && actionId
        ? `<button class="btn btn-sm warning-action" type="button" data-action="${escapeAttr(actionId)}">${escapeHtml(actionLabel)}</button>`
        : '';
    dom.warningArea.innerHTML = `<div class="warning-msg"><span>⚠️ ${escapeHtml(message)}</span>${button}</div>`;
  },
  clearWarning() {
    dom.warningArea.innerHTML = '';
  },
  showLoading(message) {
    dom.loadingArea.innerHTML = `<div class="loading-msg">⏳ ${escapeHtml(message)}</div>`;
  },
  hideLoading() {
    dom.loadingArea.innerHTML = '';
  },
  // `config-panel` é um <dialog> real (showModal/close) desde a migração pra modal —
  // dá foco preso, backdrop e Esc de graça, e libera o espaço que o painel inline
  // ocupava permanentemente na tela. `.open` é a propriedade nativa do <dialog>.
  //
  // Embedado em /jiradash (React), NUNCA abre esse <dialog> interno pra pedir config —
  // pede pro pai abrir o modal padrão do app via postMessage. Sem isso, fluxos que
  // chamam `setConfigVisible(true)` sem passar pelo botão (troca de squad, nova squad
  // sem JQL) reabriam o modal antigo por baixo do novo, com duas UIs diferentes pra
  // mesma coisa. Fechar continua sempre local: nada a sincronizar com o pai.
  isEmbedded() {
    return window.self !== window.top;
  },
  toggleConfig() {
    if (dom.configPanel.open) {
      dom.configPanel.close();
    } else if (this.isEmbedded()) {
      window.parent.postMessage({ type: 'JIRADASH_OPEN_CONFIG' }, '*');
    } else {
      dom.configPanel.showModal();
    }
  },
  setDashboardVisible(visible) {
    this.setHidden(dom.dashboard, !visible);
  },
  setConfigVisible(visible) {
    if (!dom.configPanel) return;
    if (!visible) {
      if (dom.configPanel.open) dom.configPanel.close();
      return;
    }
    if (this.isEmbedded()) {
      window.parent.postMessage({ type: 'JIRADASH_OPEN_CONFIG' }, '*');
    } else if (!dom.configPanel.open) {
      dom.configPanel.showModal();
    }
  },
  renderMetric({ label, value, sub = '', className = '' }) {
    // SEGURANÇA: `value` e `sub` são interpolados como HTML cru (alguns callers
    // passam <span> embutido). NÃO passe dados vindos do Jira (summary, assignee,
    // status name, etc.) diretamente — aplique escapeHtml antes. `label` é escapado.
    return `
            <div class="metric-card">
              <div class="metric-label">${escapeHtml(label)}</div>
              <div class="metric-value ${className}">${value}</div>
              ${sub ? `<div class="metric-sub">${sub}</div>` : ''}
            </div>`;
  }
};

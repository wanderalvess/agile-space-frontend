// Badge de status da issue: a classe vem de `issueRules`, o texto e o title são
// escapados. O template literal tem whitespace significativo — não reindente o interior.
import { escapeHtml, escapeAttr } from '../core/helpers.js';
import { issueRules } from '../domain/issue-rules.js';

export const renderStatusBadge = status => {
  const safeStatus = escapeHtml(status || '—');
  return `
          <div class="truncate">
            <span class="badge ${issueRules.getStatusBadgeClass(status)}" title="${escapeAttr(status || '—')}">${safeStatus}</span>
          </div>`;
};

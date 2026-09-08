// Helpers puros: escape, normalizacao, formatacao e pequenas utilidades.
// Extraidos de assets/js/jiradash.js sem alterar comportamento. Nao tocam DOM, state,
// storage nem rede. CONFIG entra por import por causa de issueKeyList, que monta o link
// do Jira a partir de CONFIG.jiraBrowseBase.
import { CONFIG } from './config.js';

export const escapeHtml = value =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

export const escapeAttr = escapeHtml;
export const normalize = value =>
  String(value ?? '')
    .toLowerCase()
    .trim();
export const compactName = name =>
  String(name || 'Não atribuído')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .join(' ');
// Marca [X] no nome (desligado, férias, etc.) NÃO filtra nada: quem decide se a pessoa
// aparece nos gráficos por pessoa é a Configuração (dias × horas preenchidos).
export const initials = name =>
  String(name || 'NA')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0])
    .join('')
    .toUpperCase() || 'NA';
export const secondsToHours = seconds => (seconds > 0 ? `${(seconds / 3600).toFixed(1)}h` : '—');
export const secondsToHoursNumber = seconds => (seconds > 0 ? Number((seconds / 3600).toFixed(1)) : 0);
export const formatDate = date => (date ? new Date(date).toLocaleDateString('pt-BR') : '—');
export const pctClass = pct => (pct >= 70 ? 'success' : pct >= 40 ? 'warning' : 'danger');
export const safeDomId = value => String(value || '').replace(/[^a-zA-Z0-9]/g, '_');
export const r1 = v => Math.round(v * 10) / 10;
// Renderiza uma lista compacta de issue keys clicáveis (separadas por · ).
// Usado em Composição e Qualidade — mantém visual e link consistentes.
export const issueKeyList = items =>
  items.length
    ? items
        .map(
          p =>
            `<a class="issue-key" href="${CONFIG.jiraBrowseBase}${encodeURIComponent(p.key)}" target="_blank" rel="noopener noreferrer">${escapeHtml(p.key)}</a>`
        )
        .join(' · ')
    : '—';
// Extrai o texto de um customfield do Jira: select/option vem como objeto { value },
// cascading/multi vem como array, e alguns campos vêm como string crua. Devolve '' quando
// vazio pra cair no placeholder de "não informado".
export const customFieldText = raw => {
  if (raw == null) return '';
  if (Array.isArray(raw)) return raw.map(customFieldText).filter(Boolean).join(' / ');
  if (typeof raw === 'object') {
    const self = raw.value || raw.name || '';
    const child = raw.child ? customFieldText(raw.child) : '';
    return [self, child].filter(Boolean).join(' - ');
  }
  return String(raw);
};
export const withAlpha = (hex, alpha) => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
};
export const countBy = (items, fn) =>
  items.reduce((acc, item) => {
    const key = fn(item);
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

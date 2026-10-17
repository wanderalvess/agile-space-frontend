/**
 * Configurações do sistema que de fato têm efeito hoje:
 *  - companyName: título da aba do navegador (SystemConfigContext).
 *  - primaryColor: cor primária em HSL, só no tema Espaço Clássico (os outros temas têm a própria cor).
 * Acesso anônimo, modo manutenção e URL do logo foram removidos: nada os lê.
 */
export interface SystemConfigForm {
  companyName: string;
  /** "24 93% 53%" ou vazio (= usa a cor do tema). */
  primaryColor: string;
}

export const DEFAULT_COMPANY_NAME = 'Portal Tech V&D';
/** Título da aba quando não há nome personalizado (o mesmo do layout raiz). */
export const DEFAULT_TAB_TITLE = 'Portal Tech V&D | Hub de Varejo e Distribuição';

export const DEFAULT_SYSTEM_CONFIG: SystemConfigForm = { companyName: DEFAULT_COMPANY_NAME, primaryColor: '' };

export type SystemConfigKey = keyof SystemConfigForm;

export const CONFIG_KEY_LABEL: Record<SystemConfigKey, string> = {
  companyName: 'nome da empresa',
  primaryColor: 'cor primária',
};

const NUM = '\\d{1,3}(?:\\.\\d+)?';
const HSL_RE = new RegExp(`^(${NUM})\\s+(${NUM})%\\s+(${NUM})%$`);

/** "24   93%  53%" vira "24 93% 53%". */
export function normalizeHsl(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

/** Vazio vale (volta à cor do tema); senão precisa ser "H S% L%" com H até 360 e S, L até 100. */
export function isValidHsl(value: string): boolean {
  const v = normalizeHsl(value);
  if (v === '') return true;
  const m = HSL_RE.exec(v);
  if (!m) return false;
  return Number(m[1]) <= 360 && Number(m[2]) <= 100 && Number(m[3]) <= 100;
}

/** Valor para CSS (`hsl(...)`) ou null quando vazio/inválido. */
export function hslCss(value: string): string | null {
  const v = normalizeHsl(value);
  return v !== '' && isValidHsl(v) ? `hsl(${v})` : null;
}

/** Título da aba: o padrão do portal ou "Nome | Gestão Ágil" (igual ao SystemConfigContext). */
export function tabTitleFor(companyName: string): string {
  const name = companyName.trim();
  if (!name || name === DEFAULT_COMPANY_NAME || name === 'Espaço Ágil') return DEFAULT_TAB_TITLE;
  return `${name} | Gestão Ágil`;
}

/** Mensagem de erro de validação do formulário (null = pode salvar). */
export function validateConfig(form: SystemConfigForm): { companyName: string | null; primaryColor: string | null } {
  return {
    companyName: form.companyName.trim() === '' ? 'Informe o nome da empresa' : null,
    primaryColor: isValidHsl(form.primaryColor) ? null : 'Use o formato 24 93% 53%',
  };
}

export function isConfigValid(form: SystemConfigForm): boolean {
  const e = validateConfig(form);
  return !e.companyName && !e.primaryColor;
}

/** Só as chaves que mudaram em relação ao que está salvo. */
export function changedConfigKeys(saved: SystemConfigForm, next: SystemConfigForm): SystemConfigKey[] {
  const keys: SystemConfigKey[] = [];
  if (saved.companyName.trim() !== next.companyName.trim()) keys.push('companyName');
  if (normalizeHsl(saved.primaryColor) !== normalizeHsl(next.primaryColor)) keys.push('primaryColor');
  return keys;
}

/** Valores lidos do servidor: ausente ou só espaços (jeito de "limpar") vira vazio; nome ausente vira o padrão. */
export function formFromServer(raw: { companyName: string; primaryColor: string }): SystemConfigForm {
  return {
    companyName: raw.companyName.trim() || DEFAULT_COMPANY_NAME,
    primaryColor: normalizeHsl(raw.primaryColor),
  };
}

/** "cor primária" ou "nome da empresa e cor primária". */
export function failedKeysLabel(keys: SystemConfigKey[]): string {
  return keys.map((k) => CONFIG_KEY_LABEL[k]).join(' e ');
}

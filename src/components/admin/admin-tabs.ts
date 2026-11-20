import {
  Clock,
  FileText,
  GitBranch,
  KeyRound,
  LifeBuoy,
  Megaphone,
  MessageSquareHeart,
  RefreshCw,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Target,
  TrendingUp,
  Users,
  type LucideIcon,
} from 'lucide-react';

/** Uma aba da Administração = uma URL: `/admin?tab=<id>`. */
export type AdminTabId =
  | 'usuarios'
  | 'aprovacoes'
  | 'chamados'
  | 'feedbacks'
  | 'crescimento'
  | 'cerimonias'
  | 'sessoes'
  | 'avisos'
  | 'versoes'
  | 'jira'
  | 'motor-ai'
  | 'apikeys'
  | 'sistema'
  | 'auditoria';

export interface AdminTab {
  id: AdminTabId;
  label: string;
  icon: LucideIcon;
  /** Nomes antigos (ids de antes do endereço por aba) que continuam abrindo esta aba. */
  aliases?: readonly string[];
}

export interface AdminTabGroup {
  id: string;
  label: string;
  tabs: readonly AdminTab[];
}

/** Aba aberta quando o endereço não traz `?tab=` ou traz um nome que não existe. */
export const DEFAULT_ADMIN_TAB: AdminTabId = 'usuarios';

export const ADMIN_TAB_GROUPS: readonly AdminTabGroup[] = [
  {
    id: 'pessoas',
    label: 'Pessoas e acesso',
    tabs: [
      { id: 'usuarios', label: 'Usuários & Acesso', icon: Users, aliases: ['users'] },
      { id: 'aprovacoes', label: 'Aprovações', icon: ShieldCheck, aliases: ['approvals'] },
    ],
  },
  {
    id: 'atendimento',
    label: 'Atendimento',
    tabs: [
      { id: 'chamados', label: 'Chamados', icon: LifeBuoy, aliases: ['tickets'] },
      { id: 'feedbacks', label: 'Feedbacks & NPS', icon: MessageSquareHeart, aliases: ['feedback'] },
    ],
  },
  {
    id: 'uso',
    label: 'Uso e métricas',
    tabs: [
      { id: 'crescimento', label: 'Crescimento & Métricas', icon: TrendingUp, aliases: ['growth'] },
      { id: 'cerimonias', label: 'Analytics de Cerimônias', icon: Target, aliases: ['ceremonies'] },
      { id: 'sessoes', label: 'Histórico de Sessões', icon: Clock, aliases: ['sessions'] },
    ],
  },
  {
    id: 'comunicacao',
    label: 'Comunicação',
    tabs: [
      { id: 'avisos', label: 'Anúncios & Avisos', icon: Megaphone, aliases: ['communications'] },
      { id: 'versoes', label: 'Versões & Releases', icon: GitBranch, aliases: ['changelog'] },
    ],
  },
  {
    id: 'integracoes',
    label: 'Integrações e IA',
    tabs: [
      // "governance" era o id da aba Sincronização Jira (e é o que /projects ainda manda): continua valendo.
      { id: 'jira', label: 'Sincronização Jira', icon: RefreshCw, aliases: ['governance'] },
      { id: 'motor-ai', label: 'Motor AI & Conhecimento', icon: Sparkles, aliases: ['intelligence', 'motorai'] },
      { id: 'apikeys', label: 'API Keys', icon: KeyRound, aliases: ['api-keys'] },
    ],
  },
  {
    id: 'sistema',
    label: 'Sistema',
    tabs: [
      { id: 'sistema', label: 'Configurações', icon: SlidersHorizontal, aliases: ['system'] },
      { id: 'auditoria', label: 'Auditoria & Logs', icon: FileText, aliases: ['audit'] },
    ],
  },
];

export const ADMIN_TABS: readonly AdminTab[] = ADMIN_TAB_GROUPS.flatMap((g) => g.tabs);

const BY_KEY = new Map<string, AdminTab>();
for (const tab of ADMIN_TABS) {
  BY_KEY.set(tab.id, tab);
  for (const alias of tab.aliases ?? []) BY_KEY.set(alias, tab);
}

/** Aba do endereço (`?tab=`): aceita o nome novo, o apelido antigo e qualquer caixa; desconhecido cai em Usuários. */
export function resolveAdminTab(raw: string | null | undefined): AdminTab {
  const key = (raw ?? '').trim().toLowerCase();
  return BY_KEY.get(key) ?? BY_KEY.get(DEFAULT_ADMIN_TAB)!;
}

/** `true` quando o parâmetro já é o nome oficial da aba (senão a página troca o endereço pelo oficial). */
export function isCanonicalTabParam(raw: string | null | undefined): boolean {
  return !!raw && resolveAdminTab(raw).id === raw;
}

export function adminTabHref(id: AdminTabId): string {
  return `/admin?tab=${id}`;
}

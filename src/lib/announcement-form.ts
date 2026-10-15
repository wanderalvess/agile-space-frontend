import type { AnnouncementDto, AnnouncementInput, AnnouncementType, AudienceType } from '@/lib/home-api';

export const ANNOUNCEMENT_TYPE_LABELS: Record<AnnouncementType, string> = {
  INFO: 'Aviso',
  IMPORTANT: 'Importante',
  MAINTENANCE: 'Manutenção',
};

export const AUDIENCE_LABELS: Record<AudienceType, string> = {
  ALL: 'Todos',
  SQUADS: 'Squads',
  ROLES: 'Papéis',
};

export const AUDIENCE_ROLE_OPTIONS: { value: string; label: string }[] = [
  { value: 'ADMIN', label: 'Admin' },
  { value: 'LEAD', label: 'Liderança' },
  { value: 'MEMBER', label: 'Membro' },
  { value: 'AGILE_MASTER', label: 'Agile Master' },
  { value: 'TRIBE_LEAD', label: 'Tribe Lead' },
];

export interface AnnouncementFormState {
  title: string;
  content: string;
  type: AnnouncementType;
  audienceType: AudienceType;
  audienceSquadIds: string[];
  audienceRoles: string[];
  /** Valor de <input type="datetime-local"> (hora local, sem fuso). Vazio = agora. */
  validFrom: string;
  /** Vazio = sem prazo. */
  validUntil: string;
  link: string;
}

export const EMPTY_ANNOUNCEMENT_FORM: AnnouncementFormState = {
  title: '',
  content: '',
  type: 'INFO',
  audienceType: 'ALL',
  audienceSquadIds: [],
  audienceRoles: [],
  validFrom: '',
  validUntil: '',
  link: '',
};

const pad = (n: number) => String(n).padStart(2, '0');

/** ISO → valor de datetime-local na hora local. */
export function isoToLocalInput(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** datetime-local (hora local) → ISO UTC; vazio/ inválido → null. */
export function localInputToIso(value: string): string | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export function formFromAnnouncement(a: AnnouncementDto): AnnouncementFormState {
  return {
    title: a.title || '',
    content: a.content || '',
    type: a.type || 'INFO',
    audienceType: a.audienceType || 'ALL',
    audienceSquadIds: a.audienceSquadIds || [],
    audienceRoles: a.audienceRoles || [],
    validFrom: isoToLocalInput(a.validFrom),
    validUntil: isoToLocalInput(a.validUntil),
    link: a.link || '',
  };
}

export function inputFromForm(form: AnnouncementFormState): AnnouncementInput {
  const link = form.link.trim();
  return {
    title: form.title.trim(),
    content: form.content.trim(),
    type: form.type,
    audienceType: form.audienceType,
    audienceSquadIds: form.audienceType === 'SQUADS' ? form.audienceSquadIds : [],
    audienceRoles: form.audienceType === 'ROLES' ? form.audienceRoles : [],
    validFrom: localInputToIso(form.validFrom),
    validUntil: localInputToIso(form.validUntil),
    link: link || null,
  };
}

/** Mesmas regras do backend (seção 1 do contrato). Devolve a primeira mensagem de erro ou null. */
export function validateAnnouncementForm(form: AnnouncementFormState): string | null {
  const title = form.title.trim();
  const content = form.content.trim();
  if (!title) return 'Informe o título.';
  if (title.length > 120) return 'Título com no máximo 120 caracteres.';
  if (!content) return 'Informe o texto.';
  if (content.length > 2000) return 'Texto com no máximo 2000 caracteres.';
  const link = form.link.trim();
  if (link) {
    if (link.length > 500) return 'Link com no máximo 500 caracteres.';
    if (!/^https?:\/\//i.test(link) && !link.startsWith('/')) return 'Link deve começar com http(s):// ou /.';
  }
  if (form.audienceType === 'SQUADS' && form.audienceSquadIds.length === 0) return 'Escolha ao menos uma squad.';
  if (form.audienceType === 'ROLES' && form.audienceRoles.length === 0) return 'Escolha ao menos um papel.';
  const from = localInputToIso(form.validFrom);
  const until = localInputToIso(form.validUntil);
  if (until) {
    const start = from ? new Date(from).getTime() : Date.now();
    if (new Date(until).getTime() <= start) return 'O fim da vigência deve ser depois do início.';
  }
  return null;
}

/** "para todas as squads" / "para Phoenix, Atlas" / "para Agile Masters". */
export function audienceSummary(a: Pick<AnnouncementDto, 'audienceType' | 'audienceSquadIds' | 'audienceRoles'>, squadNames: Record<string, string> = {}): string {
  if (a.audienceType === 'SQUADS') {
    const names = (a.audienceSquadIds || []).map((id) => squadNames[id] || id);
    return names.length ? `para ${names.join(', ')}` : 'para squads';
  }
  if (a.audienceType === 'ROLES') {
    const labels = (a.audienceRoles || []).map((r) => AUDIENCE_ROLE_OPTIONS.find((o) => o.value === r)?.label || r);
    return labels.length ? `para ${labels.join(', ')}` : 'para papéis';
  }
  return 'para todos';
}

/**
 * Regras puras do cabeçalho de sala (RoomTopBar): título editável, pilha de
 * presença e indicadores do menu "Mais". Ficam fora do componente para serem
 * testadas sem DOM.
 */

/**
 * Título digitado -> título a salvar. Devolve `null` quando não há o que salvar
 * (vazio ou igual ao atual), para a sala não gravar à toa nem aceitar nome em branco.
 */
export function normalizeRoomTitle(next: string, current: string): string | null {
  const trimmed = next.trim().replace(/\s+/g, ' ');
  if (!trimmed || trimmed === current.trim()) return null;
  return trimmed;
}

export interface TopBarPerson {
  id: string;
  name: string;
  online: boolean;
}

export interface PresenceStackResult {
  /** Quem aparece como avatar (até `max`), online primeiro. */
  visible: TopBarPerson[];
  /** Quantos ficaram de fora ("+N"). */
  extra: number;
  /** Total de pessoas online. */
  onlineCount: number;
  /** Total de pessoas na sala. */
  total: number;
}

/**
 * Pilha de avatares da presença: quem está online vem primeiro (ordem original
 * preservada dentro de cada grupo); o excedente vira "+N". Se ninguém está
 * online, mostra quem estiver na lista, para a pilha nunca ficar vazia com gente na sala.
 */
export function presenceStack(people: readonly TopBarPerson[], max = 3): PresenceStackResult {
  const online = people.filter((p) => p.online);
  const offline = people.filter((p) => !p.online);
  const ordered = [...online, ...offline];
  const limit = Math.max(0, max);
  return {
    visible: ordered.slice(0, limit),
    extra: Math.max(0, ordered.length - limit),
    onlineCount: online.length,
    total: people.length,
  };
}

/**
 * Quantos avatares cabem na pilha do cabeçalho: 4 a partir de 1536 px, 3 abaixo disso e 2 no celular
 * (o excedente vira "+N"). Com avatares de 28 a 32 px mais que isso empurra o título da sala.
 */
export function presenceMaxAvatars(wide: boolean, phone: boolean): number {
  if (wide) return 4;
  return phone ? 2 : 3;
}

/** Texto acessível do botão de presença: "3 online de 5 participantes". */
export function presenceLabel(stack: Pick<PresenceStackResult, 'onlineCount' | 'total'>): string {
  const { onlineCount, total } = stack;
  if (total === 0) return 'Participantes (ninguém na sala)';
  if (total === 1) return onlineCount === 1 ? 'Participantes (1 online)' : 'Participantes (1 pessoa)';
  return `Participantes (${onlineCount} online de ${total})`;
}

/** Texto acessível do botão de presença quando não se sabe quem está conectado: "9 participantes". */
export function presenceCountLabel(total: number): string {
  if (total === 0) return 'Participantes (ninguém na sala)';
  return `Participantes (${total})`;
}

/** Camadas de ação por largura: `core` (>= 640 px), `mid` (>= 1536 px), `wide` (>= 1920 px). */
export type TopBarTier = 'core' | 'mid' | 'wide';

export interface TierIndicatorSource {
  tier?: TopBarTier;
  badge?: number;
  dot?: boolean;
}

/**
 * Quais camadas de ação têm indicador pendente (contagem ou ponto). Quando a
 * camada está recolhida no "Mais", o botão do menu herda o ponto para a pessoa
 * não perder uma mensagem não lida só porque a tela é estreita.
 */
export function pendingTiers(actions: readonly TierIndicatorSource[]): Record<TopBarTier, boolean> {
  const result: Record<TopBarTier, boolean> = { core: false, mid: false, wide: false };
  for (const a of actions) {
    if ((a.badge ?? 0) > 0 || a.dot) result[a.tier ?? 'core'] = true;
  }
  return result;
}

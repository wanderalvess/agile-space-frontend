import type { CreateTicketPayload } from '@/app/support/api';

export const CARGO_REQUEST_SUBJECT = 'Ajuste de cargo';
export const OTHER_CARGO = '__outro__';
export const MAX_REASON = 500;
export const MAX_CARGO = 80;

export interface CargoRequestInput {
  currentCargo?: string;
  /** Opção escolhida na lista (ou `OTHER_CARGO`). */
  desired: string;
  /** Texto do campo livre, usado quando `desired === OTHER_CARGO`. */
  other: string;
  reason: string;
  email?: string;
  squad?: string;
  name?: string;
}

/** Cargo pedido, já resolvido (lista ou campo livre). */
export function desiredCargoOf(i: Pick<CargoRequestInput, 'desired' | 'other'>): string {
  return (i.desired === OTHER_CARGO ? i.other : i.desired).trim();
}

/**
 * Corpo do chamado para o Suporte (cargo atual, desejado, motivo, e-mail e squad ativa).
 * Usa o tipo "support" da API de chamados: não há categoria própria para ajuste de cargo.
 */
export function buildCargoRequestTicket(i: CargoRequestInput): CreateTicketPayload {
  const desired = desiredCargoOf(i);
  const lines = [
    `Cargo atual: ${i.currentCargo?.trim() || 'não informado'}`,
    `Cargo desejado: ${desired || 'não informado (ver motivo)'}`,
    `Motivo: ${i.reason.trim() || 'não informado'}`,
    `E-mail: ${i.email?.trim() || 'não informado'}`,
    `Squad ativa: ${i.squad?.trim() || 'nenhuma'}`,
  ];
  return { subject: CARGO_REQUEST_SUBJECT, message: lines.join('\n'), type: 'support', requesterName: i.name?.trim() || undefined };
}

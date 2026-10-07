import { authFetch } from '@/lib/auth-client';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_SPRING_API_URL || 'http://localhost:8002/api';

export type EventType = 'system' | 'admin' | 'security' | 'action';
export type EventSeverity = 'info' | 'warning' | 'critical';

export interface AuditEvent {
  content: string;
  type: EventType;
  severity: EventSeverity;
  userEmail?: string | null;
  module?: string;
  metadata?: Record<string, any>;
}

/**
 * Registra um evento de auditoria no backend (POST /admin/audit-logs), que
 * persiste na tabela audit_logs no Postgres. `action` e `performedBy` vão
 * como query params (formato esperado pelo AdminController) e o conteúdo do
 * evento (com metadados anexados, quando houver) vira o corpo cru (`details`).
 */
export const logSystemEvent = async (event: AuditEvent) => {
  try {
    const action = event.module || event.type;
    const performedBy = event.userEmail || 'system';
    const details = event.metadata
      ? `${event.content} | metadata: ${JSON.stringify(event.metadata)}`
      : event.content;

    const params = new URLSearchParams({ action, performedBy });
    await authFetch(`${API_BASE_URL}/admin/audit-logs?${params.toString()}`, {
      method: 'POST',
      body: details,
    });
  } catch (e) {
    console.error('Error logging system event:', e);
  }
};

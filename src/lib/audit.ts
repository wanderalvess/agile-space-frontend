import { collection, addDoc, serverTimestamp, Firestore } from 'firebase/firestore';

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
 * Logs a system event to the 'system_events' collection in Firestore.
 */
export const logSystemEvent = async (
  firestore: Firestore,
  event: AuditEvent
) => {
  try {
    await addDoc(collection(firestore, 'system_events'), {
      ...event,
      timestamp: serverTimestamp()
    });
  } catch (e) {
    console.error("Error logging system event:", e);
  }
};

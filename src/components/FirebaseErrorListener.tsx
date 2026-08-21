'use client';

import { useEffect } from 'react';
import { toast } from 'sonner';
import { errorEmitter, type FirestoreIssue } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
// Import direto do provider: este componente é renderizado dentro dele, e passar
// pelo index de '@/firebase' alargaria o ciclo de importação sem necessidade.
import { useFirebase } from '@/firebase/provider';
import { logSystemEvent } from '@/lib/audit';

/**
 * Ouve as falhas de Firestore publicadas pelo emitter global e faz três coisas:
 * mostra um toast para quem está usando, deixa o detalhe completo no console
 * para quem está depurando, e registra o evento em system_events para o admin
 * ver no painel de governança.
 *
 * Antes, em desenvolvimento este componente dava `throw` no erro para cair no
 * overlay do Next.js. Isso derrubava a tela inteira a cada falha — inclusive
 * falhas recuperáveis, como um índice ainda em construção — e escondia o resto
 * da aplicação atrás de uma stack trace.
 */

/** Janela de deduplicação: a mesma falha se repete a cada retry do snapshot. */
const DEDUPE_WINDOW_MS = 5 * 60 * 1000;
const lastSeen = new Map<string, number>();

const shouldReport = (key: string) => {
  const now = Date.now();
  const previous = lastSeen.get(key);
  if (previous && now - previous < DEDUPE_WINDOW_MS) return false;
  lastSeen.set(key, now);
  return true;
};

/** Primeiro segmento do path — serve como nome do módulo no log de auditoria. */
const moduleFromPath = (path: string) => path.split('/')[0] || 'desconhecido';

const MESSAGES: Record<string, { title: string; description: string }> = {
  'failed-precondition': {
    title: 'Consulta indisponível no momento',
    description: 'Falta um índice no banco ou ele ainda está sendo construído. A equipe já foi notificada.'
  },
  unavailable: {
    title: 'Sem conexão com o banco',
    description: 'Verifique sua internet. Os dados voltam sozinhos assim que a conexão retornar.'
  },
  'resource-exhausted': {
    title: 'Limite do banco atingido',
    description: 'O projeto excedeu a cota do Firestore. A equipe já foi notificada.'
  },
  'deadline-exceeded': {
    title: 'A consulta demorou demais',
    description: 'Tente recarregar a página.'
  }
};

const fallbackMessage = (code: string) => ({
  title: 'Falha ao carregar dados',
  description: `O banco respondeu com "${code}". A equipe já foi notificada.`
});

export function FirebaseErrorListener() {
  const { firestore, user } = useFirebase();

  useEffect(() => {
    if (!user || !firestore) return;
    const report = (
      key: string,
      content: string,
      type: 'security' | 'system',
      metadata: Record<string, any>
    ) => {
      if (!shouldReport(key)) return;

      // Gravar em system_events exige usuário autenticado pelas regras; sem
      // login, tentar registrar geraria uma nova falha de permissão em laço.
      if (!firestore || !user) return;

      logSystemEvent(firestore, {
        content,
        type,
        severity: 'warning',
        userEmail: user.email,
        module: metadata.module,
        metadata
      });
    };

    const handlePermissionError = (error: FirestorePermissionError) => {
      const path = error.request?.path || 'desconhecido';
      const operation = error.request?.method || 'write';
      const key = `permission-denied:${path}:${operation}`;

      console.warn(`[Firestore] permissão negada em ${operation} ${path}`, error);

      toast.error('Ação não permitida', {
        id: key,
        description: 'Você não tem acesso a esse dado. Se acha que deveria ter, avise o time.'
      });

      report(key, `Permissão negada: ${operation} em ${path}`, 'security', {
        module: moduleFromPath(path),
        path,
        operation,
        code: 'permission-denied'
      });
    };

    const handleFirestoreIssue = (issue: FirestoreIssue) => {
      const key = `${issue.code}:${issue.path}:${issue.operation}`;

      console.warn(
        `[Firestore] ${issue.operation} em ${issue.path} falhou [${issue.code}]: ${issue.message}`
      );

      if (issue.notifyUser) {
        const { title, description } = MESSAGES[issue.code] || fallbackMessage(issue.code);
        toast.error(title, { id: key, description });
      }

      report(key, `Falha no Firestore (${issue.code}): ${issue.operation} em ${issue.path}`, 'system', {
        module: moduleFromPath(issue.path),
        path: issue.path,
        operation: issue.operation,
        code: issue.code,
        message: issue.message
      });
    };

    errorEmitter.on('permission-error', handlePermissionError);
    errorEmitter.on('firestore-error', handleFirestoreIssue);

    return () => {
      errorEmitter.off('permission-error', handlePermissionError);
      errorEmitter.off('firestore-error', handleFirestoreIssue);
    };
  }, [firestore, user]);

  return null;
}

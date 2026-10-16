'use client';

/**
 * Importação de squads do Jira (Profields): formulário de credenciais, prévia do que será importado e
 * confirmação. Nada é gravado até a confirmação.
 *
 * Aceita várias chaves de uma vez: o Agile Master costuma cuidar de várias squads, então cada chave entra
 * numa fila (lib/import-queue), com prévia e confirmação próprias, sem pedir endereço e token de novo.
 *
 * Usado no /onboarding e no /painel (onde quem criou a squad na mão importa pessoas e papéis depois).
 * Quem usa decide o que fazer ao concluir (onImported): o componente só importa e troca de projeto.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/AuthContext';
import { useUserContext } from '@/context/UserContext';
import { useJiraSettings } from '@/hooks/useJiraSettings';
import { projectService, type ProjectDetail, type ProjectImportConfirmBody, type ProjectMemberRoleItem } from '@/services/projectService';
import { ImportPreview } from '@/components/onboarding/ImportPreview';
import { JiraCredentialsForm } from '@/components/onboarding/JiraCredentialsForm';
import { cleanJiraDomain } from '@/lib/jira-import';
import { SQUAD_PEOPLE_ADMIN_ROLES } from '@/lib/types';
import {
  hasJiraFormErrors,
  jiraFormToastTitle,
  parseProjectKeys,
  validateJiraForm,
  type JiraFormErrors,
} from '@/lib/onboarding';
import {
  abandonRemaining,
  addImported,
  addSkipped,
  createQueue,
  hasNext,
  isBatch,
  isFirstImport,
  pointAt,
  queueEndNotice,
  queueLabel,
  type ImportQueue,
} from '@/lib/import-queue';

// Mantido aqui para quem já importava daqui; a regra mora em lib/onboarding.
export { parseProjectKeys };

export interface JiraImportResult {
  /** Primeira squad importada (a que fica ativa). */
  project: ProjectDetail;
  /** Papel da própria pessoa na lista importada, se ela foi reconhecida. */
  myRoleName?: string;
  /** Verdadeiro quando o papel dela administra pessoas da squad. */
  leadsPeople: boolean;
  /** Todas as squads gravadas nesta rodada (mais de uma no import em lote). */
  importedProjects: ProjectDetail[];
  /** Chaves que falharam na prévia ou foram puladas. */
  notImportedKeys: string[];
  /** O token ficou guardado na conta da pessoa. Falso: vale só neste navegador. */
  tokenSaved: boolean;
}

interface JiraProfieldsImportProps {
  /** Chave do projeto no Jira já preenchida (ex.: a squad atual). */
  initialProjectKey?: string;
  onImported: (result: JiraImportResult) => void;
  /** Saída alternativa mostrada na lateral (ex.: "Criar uma squad sem o Jira"). */
  skipAction?: { label: string; onClick: () => void };
  /** Texto de ajuda da lateral, quando o contexto pede algo diferente do padrão. */
  skipHint?: string;
  /** "Voltar" do formulário (no /onboarding). */
  onBack?: () => void;
  /** Avisa quando a prévia (tela larga) abre ou fecha, para o contexto liberar espaço. */
  onPreviewChange?: (active: boolean) => void;
}

export function JiraProfieldsImport({ initialProjectKey = '', onImported, skipAction, skipHint, onBack, onPreviewChange }: JiraProfieldsImportProps) {
  const { toast } = useToast();
  const { switchProject } = useAuth();
  const { userProfile } = useUserContext();
  const { settings: jiraSettings, saveSettings: saveJiraSettings } = useJiraSettings();

  const [busy, setBusy] = useState<'jira' | 'confirm' | null>(null);
  const [jiraDomain, setJiraDomain] = useState('');
  const [jiraKey, setJiraKey] = useState(initialProjectKey);
  const [jiraToken, setJiraToken] = useState('');
  const [errors, setErrors] = useState<JiraFormErrors>({});
  const [syncedProject, setSyncedProject] = useState<ProjectDetail | null>(null);
  const [queue, setQueue] = useState<ImportQueue | null>(null);
  const tokenSavedRef = useRef(true);

  useEffect(() => {
    if (jiraSettings) {
      if (jiraSettings.domain && !jiraDomain) setJiraDomain(jiraSettings.domain);
      if (jiraSettings.token && !jiraToken) setJiraToken(jiraSettings.token);
    }
    // Só preenche a partir do que a conta já guardou; o que a pessoa digita depois não é sobrescrito.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jiraSettings]);

  const myEmail = (userProfile?.email || '').toLowerCase().trim();
  const isMe = useCallback(
    (m: ProjectMemberRoleItem) => (!!userProfile?.id && m.userId === userProfile.id) || (!!myEmail && (m.email || '').toLowerCase().trim() === myEmail),
    [userProfile?.id, myEmail],
  );

  useEffect(() => {
    onPreviewChange?.(!!syncedProject);
    return () => onPreviewChange?.(false);
  }, [syncedProject, onPreviewChange]);

  const finishQueue = useCallback(
    (done: ProjectDetail[], skipped: string[]) => {
      setSyncedProject(null);
      setQueue(null);
      const notice = queueEndNotice(done.length, skipped);
      if (notice) toast(notice);
      if (done.length === 0) return;
      const first = done[0];
      const mine = first.members.find(isMe);
      const leadsPeople = !!mine && (SQUAD_PEOPLE_ADMIN_ROLES as string[]).includes(mine.roleName);
      onImported({
        project: first,
        myRoleName: mine?.roleName,
        leadsPeople,
        importedProjects: done,
        notImportedKeys: skipped,
        tokenSaved: tokenSavedRef.current,
      });
    },
    [isMe, onImported, toast],
  );

  /** Abre a prévia da próxima squad da fila que o Jira devolver; as que falham entram em "sem importar". */
  const openFrom = useCallback(
    async (q: ImportQueue, from: number) => {
      let cur = q;
      for (let i = from; i < cur.keys.length; i++) {
        setBusy('jira');
        try {
          const preview = await projectService.previewProjectProfields(cur.keys[i], cleanJiraDomain(jiraDomain), jiraToken.trim());
          setQueue(pointAt(cur, i));
          setSyncedProject(preview);
          setBusy(null);
          if (!isBatch(cur)) {
            toast({ title: 'Dados encontrados no Jira', description: 'Nada foi gravado ainda. Confira e confirme pra importar.' });
          }
          return;
        } catch (err: any) {
          if (!isBatch(cur)) {
            toast({ title: 'Falha na sincronização', description: err.message, variant: 'destructive' });
            setQueue(null);
            setBusy(null);
            return;
          }
          toast({ title: `Não consegui ler ${cur.keys[i]}`, description: err.message, variant: 'destructive' });
          cur = addSkipped(cur, cur.keys[i]);
        }
      }
      setBusy(null);
      finishQueue(cur.imported, cur.skipped);
    },
    [jiraDomain, jiraToken, toast, finishQueue],
  );

  const handlePreview = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const found = validateJiraForm({ domain: jiraDomain, keys: jiraKey, token: jiraToken });
      setErrors(found);
      if (hasJiraFormErrors(found)) {
        toast({ title: jiraFormToastTitle(found), variant: 'destructive' });
        return;
      }
      tokenSavedRef.current = true;
      const q = createQueue(parseProjectKeys(jiraKey));
      setQueue(q);
      await openFrom(q, 0);
    },
    [jiraDomain, jiraKey, jiraToken, toast, openFrom],
  );

  const handleConfirm = useCallback(
    async (body: ProjectImportConfirmBody) => {
      if (!syncedProject || !queue) return;
      setBusy('confirm');
      try {
        const saved = await projectService.confirmProjectProfields(syncedProject.id, body, cleanJiraDomain(jiraDomain), jiraToken.trim());
        // A squad JÁ está gravada no servidor. Se um passo posterior falhar, não diga que a importação falhou
        // (a pessoa tentaria de novo): avise só do que faltou e siga a fila.
        try {
          // O projeto ativo fica na primeira squad importada; as demais só entram na lista da pessoa.
          if (isFirstImport(queue)) await switchProject(syncedProject.id);
        } catch {
          toast({ title: 'Squad importada, mas não foi possível ativá-la', description: 'Troque de squad pelo seletor no topo da página.', variant: 'destructive' });
        }
        if (jiraToken.trim()) {
          const tokenSaved = await saveJiraSettings({ domain: cleanJiraDomain(jiraDomain), token: jiraToken.trim() });
          if (!tokenSaved) {
            tokenSavedRef.current = false;
            toast({
              title: 'Squad importada, mas o token não ficou guardado na sua conta',
              description: 'Ele vale só neste navegador. Informe-o de novo se trocar de máquina.',
              variant: 'destructive',
            });
          }
        }
        const next = addImported(queue, saved);
        if (hasNext(next)) {
          setQueue(next);
          await openFrom(next, next.index + 1);
        } else {
          finishQueue(next.imported, next.skipped);
        }
      } catch (err: any) {
        toast({ title: 'Não foi possível importar', description: err.message, variant: 'destructive' });
      } finally {
        setBusy(null);
      }
    },
    [syncedProject, queue, jiraDomain, jiraToken, switchProject, saveJiraSettings, openFrom, finishQueue, toast],
  );

  const handleSkip = useCallback(async () => {
    if (!syncedProject || !queue) return;
    const next = addSkipped(queue, syncedProject.id);
    if (hasNext(next)) {
      setQueue(next);
      await openFrom(next, next.index + 1);
    } else {
      finishQueue(next.imported, next.skipped);
    }
  }, [syncedProject, queue, openFrom, finishQueue]);

  const handleBack = useCallback(() => {
    if (queue && queue.imported.length > 0) {
      const { done, skipped } = abandonRemaining(queue);
      finishQueue(done, skipped);
      return;
    }
    setSyncedProject(null);
    setQueue(null);
  }, [queue, finishQueue]);

  // Prévia: conferir, editar e escolher antes de gravar
  if (syncedProject && queue) {
    return (
      <ImportPreview
        project={syncedProject}
        isMe={isMe}
        busy={busy !== null}
        onBack={handleBack}
        onConfirm={handleConfirm}
        blocked={syncedProject.canImport === false}
        queueLabel={queueLabel(queue)}
        onSkip={isBatch(queue) ? handleSkip : undefined}
      />
    );
  }

  return (
    <JiraCredentialsForm
      domain={jiraDomain}
      keys={jiraKey}
      token={jiraToken}
      errors={errors}
      busy={busy !== null}
      keyCount={parseProjectKeys(jiraKey).length}
      onDomainChange={(v) => {
        setJiraDomain(v);
        if (errors.domain) setErrors((e) => ({ ...e, domain: undefined }));
      }}
      onKeysChange={(v) => {
        setJiraKey(v);
        if (errors.keys) setErrors((e) => ({ ...e, keys: undefined }));
      }}
      onTokenChange={(v) => {
        setJiraToken(v);
        if (errors.token) setErrors((e) => ({ ...e, token: undefined }));
      }}
      onSubmit={handlePreview}
      onBack={onBack}
      skipAction={skipAction}
      skipHint={skipHint}
    />
  );
}

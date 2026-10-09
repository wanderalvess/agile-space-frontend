'use client';

/**
 * Importação de times do Jira (Profields): formulário de credenciais, prévia
 * do que será importado e confirmação. Nada é gravado até a confirmação.
 *
 * Aceita várias chaves de uma vez: o Agile Master costuma cuidar de várias
 * equipes, então cada chave entra numa fila, com prévia e confirmação próprias,
 * sem pedir domínio e token de novo.
 *
 * Extraído do /onboarding pra ser reaproveitado no /painel, onde quem criou o
 * time na mão pode importar pessoas e papéis depois. Quem usa decide o que
 * fazer ao concluir (onImported) — o componente só importa e troca de projeto.
 */

import { useCallback, useEffect, useState } from 'react';
import { ArrowRight, ExternalLink, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/AuthContext';
import { useUserContext } from '@/context/UserContext';
import { useJiraSettings } from '@/hooks/useJiraSettings';
import { projectService, type ProjectDetail, type ProjectImportConfirmBody, type ProjectMemberRoleItem } from '@/services/projectService';
import { JiraImportPreview } from '@/components/jira/JiraImportPreview';
import { SQUAD_PEOPLE_ADMIN_ROLES } from '@/lib/types';

export interface JiraImportResult {
  /** Primeira equipe importada (a que fica ativa). */
  project: ProjectDetail;
  /** Papel da própria pessoa na lista importada, se ela foi reconhecida. */
  myRoleName?: string;
  /** Verdadeiro quando o papel dela administra pessoas da squad. */
  leadsPeople: boolean;
  /** Todas as equipes gravadas nesta rodada (mais de uma no import em lote). */
  importedProjects: ProjectDetail[];
  /** Chaves que falharam na prévia ou foram puladas. */
  notImportedKeys: string[];
}

/** "abc, def  ghi;ABC" -> ["ABC", "DEF", "GHI"]. */
export function parseProjectKeys(raw: string): string[] {
  const keys = raw.split(/[\s,;]+/).map(k => k.trim().toUpperCase()).filter(Boolean);
  return Array.from(new Set(keys));
}

interface JiraProfieldsImportProps {
  /** Chave do projeto no Jira já preenchida (ex.: a squad atual). */
  initialProjectKey?: string;
  onImported: (result: JiraImportResult) => void;
  /** Saída alternativa mostrada na lateral (ex.: "Criar o time sem o Jira"). */
  skipAction?: { label: string; onClick: () => void };
  /** Texto de ajuda da lateral, quando o contexto pede algo diferente do padrão. */
  skipHint?: string;
  /** Avisa quando a prévia (tela larga) abre ou fecha, para o contexto liberar espaço. */
  onPreviewChange?: (active: boolean) => void;
}

export function JiraProfieldsImport({ initialProjectKey = '', onImported, skipAction, skipHint, onPreviewChange }: JiraProfieldsImportProps) {
  const { toast } = useToast();
  const { switchProject } = useAuth();
  const { userProfile } = useUserContext();
  const { settings: jiraSettings, saveSettings: saveJiraSettings } = useJiraSettings();

  const [busy, setBusy] = useState<'jira' | 'confirm' | null>(null);
  const [jiraDomain, setJiraDomain] = useState('');
  const [jiraKey, setJiraKey] = useState(initialProjectKey);
  const [jiraToken, setJiraToken] = useState('');
  const [syncedProject, setSyncedProject] = useState<ProjectDetail | null>(null);

  // Fila: cada chave tem a própria prévia e confirmação.
  const [queue, setQueue] = useState<string[]>([]);
  const [queueIndex, setQueueIndex] = useState(0);
  const [imported, setImported] = useState<ProjectDetail[]>([]);
  const [notImported, setNotImported] = useState<string[]>([]);
  const inQueue = queue.length > 1;

  useEffect(() => {
    if (jiraSettings) {
      if (jiraSettings.domain && !jiraDomain) setJiraDomain(jiraSettings.domain);
      if (jiraSettings.token && !jiraToken) setJiraToken(jiraSettings.token);
    }
  }, [jiraSettings]);

  const myEmail = (userProfile?.email || '').toLowerCase().trim();
  const isMe = useCallback((m: ProjectMemberRoleItem) =>
    (!!userProfile?.id && m.userId === userProfile.id) ||
    (!!myEmail && (m.email || '').toLowerCase().trim() === myEmail),
  [userProfile?.id, myEmail]);

  useEffect(() => {
    onPreviewChange?.(!!syncedProject);
    return () => onPreviewChange?.(false);
  }, [syncedProject, onPreviewChange]);

  const finishQueue = useCallback((done: ProjectDetail[], skipped: string[]) => {
    setSyncedProject(null);
    setQueue([]);
    setQueueIndex(0);
    setImported([]);
    setNotImported([]);
    if (done.length === 0) {
      toast({ title: 'Nenhuma equipe foi importada', description: skipped.length ? `Sem importar: ${skipped.join(', ')}.` : undefined });
      return;
    }
    if (skipped.length) {
      toast({ title: `${done.length} importada${done.length === 1 ? '' : 's'}`, description: `Sem importar: ${skipped.join(', ')}.` });
    }
    const first = done[0];
    const mine = first.members.find(isMe);
    const leadsPeople = !!mine && (SQUAD_PEOPLE_ADMIN_ROLES as string[]).includes(mine.roleName);
    onImported({ project: first, myRoleName: mine?.roleName, leadsPeople, importedProjects: done, notImportedKeys: skipped });
  }, [isMe, onImported, toast]);

  /** Abre a prévia da próxima equipe da fila que o Jira devolver; as que falham entram em "sem importar". */
  const openFrom = useCallback(async (keys: string[], from: number, done: ProjectDetail[], skippedSoFar: string[]) => {
    let skipped = skippedSoFar;
    for (let i = from; i < keys.length; i++) {
      setBusy('jira');
      try {
        const preview = await projectService.previewProjectProfields(keys[i], jiraDomain.trim(), jiraToken.trim());
        setQueueIndex(i);
        setSyncedProject(preview);
        setBusy(null);
        if (keys.length === 1) {
          toast({ title: 'Dados encontrados no Jira', description: 'Nada foi gravado ainda. Confira e confirme pra importar.' });
        }
        return;
      } catch (err: any) {
        if (keys.length === 1) {
          toast({ title: 'Falha na sincronização', description: err.message, variant: 'destructive' });
          setQueue([]);
          setBusy(null);
          return;
        }
        toast({ title: `Não consegui ler ${keys[i]}`, description: err.message, variant: 'destructive' });
        skipped = [...skipped, keys[i]];
        setNotImported(skipped);
      }
    }
    setBusy(null);
    finishQueue(done, skipped);
  }, [jiraDomain, jiraToken, toast, finishQueue]);

  const handlePreview = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    const keys = parseProjectKeys(jiraKey);
    if (keys.length === 0 || !jiraToken.trim()) {
      toast({ title: 'Informe a chave do projeto e seu token do Jira', variant: 'destructive' });
      return;
    }
    setQueue(keys);
    setQueueIndex(0);
    setImported([]);
    setNotImported([]);
    await openFrom(keys, 0, [], []);
  }, [jiraKey, jiraToken, toast, openFrom]);

  const handleConfirm = useCallback(async (body: ProjectImportConfirmBody) => {
    if (!syncedProject) return;
    setBusy('confirm');
    try {
      const saved = await projectService.confirmProjectProfields(syncedProject.id, body, jiraDomain.trim(), jiraToken.trim());
      // O projeto ativo fica na primeira equipe importada; as demais só entram na lista da pessoa.
      if (imported.length === 0) await switchProject(syncedProject.id);
      if (jiraToken.trim()) {
        await saveJiraSettings({ domain: jiraDomain.trim(), token: jiraToken.trim() });
      }
      const done = [...imported, saved];
      setImported(done);
      if (queueIndex + 1 < queue.length) {
        await openFrom(queue, queueIndex + 1, done, notImported);
      } else {
        finishQueue(done, notImported);
      }
    } catch (err: any) {
      toast({ title: 'Não foi possível importar', description: err.message, variant: 'destructive' });
    } finally {
      setBusy(null);
    }
  }, [syncedProject, jiraDomain, jiraToken, imported, queue, queueIndex, notImported, switchProject, saveJiraSettings, openFrom, finishQueue, toast]);

  const handleSkip = useCallback(async () => {
    if (!syncedProject) return;
    const skipped = [...notImported, syncedProject.id];
    setNotImported(skipped);
    if (queueIndex + 1 < queue.length) {
      await openFrom(queue, queueIndex + 1, imported, skipped);
    } else {
      finishQueue(imported, skipped);
    }
  }, [syncedProject, notImported, queueIndex, queue, imported, openFrom, finishQueue]);

  const handleBack = useCallback(() => {
    if (imported.length > 0) {
      finishQueue(imported, [...notImported, ...queue.slice(queueIndex)]);
      return;
    }
    setSyncedProject(null);
    setQueue([]);
  }, [imported, notImported, queue, queueIndex, finishQueue]);

  // Prévia: conferir, editar e escolher antes de gravar
  if (syncedProject) {
    return (
      <JiraImportPreview
        project={syncedProject}
        isMe={isMe}
        busy={busy !== null}
        onBack={handleBack}
        onConfirm={handleConfirm}
        blocked={syncedProject.canImport === false}
        queueLabel={inQueue ? `Equipe ${queueIndex + 1} de ${queue.length}` : undefined}
        onSkip={inQueue ? handleSkip : undefined}
      />
    );
  }

  const keyCount = parseProjectKeys(jiraKey).length;

  // Formulário
  return (
    <div className="w-full grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-4">
      <form onSubmit={handlePreview} className="bg-card/80 backdrop-blur-xl border border-border/60 rounded-3xl p-6 flex flex-col gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="jira-dominio" className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Domínio</Label>
          <Input id="jira-dominio" value={jiraDomain} onChange={e => setJiraDomain(e.target.value)}
            placeholder="empresa.atlassian.net" autoComplete="off" className="h-11 rounded-xl" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="jira-chave" className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Projetos no Jira</Label>
          <Input id="jira-chave" name="jiraProjectKey" value={jiraKey} onChange={e => setJiraKey(e.target.value)}
            placeholder="Ex: DDWMISSI, DDWFENIX, DDWATLAS" autoComplete="off" data-lpignore="true"
            className="h-11 font-code uppercase rounded-xl" />
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            Cuida de mais de uma equipe? Cole todas as chaves, separadas por vírgula ou espaço. Cada equipe tem a sua prévia e só grava quando você confirma.
          </p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="jira-token" className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Seu token do Jira</Label>
          <Input id="jira-token" name="jiraPersonalAccessToken" type="password" value={jiraToken}
            onChange={e => setJiraToken(e.target.value)} autoComplete="new-password" data-lpignore="true"
            placeholder="Token de acesso do Jira" className="h-11 font-code rounded-xl" />
        </div>
        <Button type="submit" disabled={busy !== null} className="h-12 rounded-xl font-bold gap-2">
          {busy === 'jira'
            ? <Loader2 className="w-4 h-4 animate-spin" />
            : <>{keyCount > 1 ? `Começar com ${keyCount} equipes` : 'Ver o que vai ser importado'} <ArrowRight className="w-4 h-4" /></>}
        </Button>
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          O token fica guardado na sua conta e nada é gravado até você conferir a prévia.
        </p>
      </form>

      <aside className="bg-card/50 border border-border/50 rounded-3xl p-5 flex flex-col gap-3">
        <div className="text-sm font-extrabold font-headline">Não tem um token? Leva 30 segundos.</div>
        {[
          'Abra a página de tokens da Atlassian (o botão abaixo abre em outra aba).',
          'Clique em Create API token e dê o nome Portal Tech V&D.',
          'Copie e cole aqui. A gente guarda pra você não precisar de novo.',
        ].map((text, i) => (
          <div key={i} className="flex gap-2.5">
            <div className="w-5 h-5 rounded-full bg-primary/10 border border-primary/25 text-primary flex items-center justify-center text-[10px] font-bold shrink-0">
              {i + 1}
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">{text}</p>
          </div>
        ))}
        <Button asChild variant="outline" className="rounded-xl text-xs font-bold gap-2 mt-1">
          <a href="https://id.atlassian.com/manage-profile/security/api-tokens" target="_blank" rel="noopener noreferrer">
            Abrir página de tokens <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </Button>
        {skipAction && (
          <>
            {!!skipHint && (
              <p className="text-[11px] text-muted-foreground leading-relaxed mt-auto pt-3 border-t border-border/50">{skipHint}</p>
            )}
            <Button variant="ghost" onClick={skipAction.onClick} className="text-xs font-bold self-start px-0">
              {skipAction.label}
            </Button>
          </>
        )}
      </aside>
    </div>
  );
}

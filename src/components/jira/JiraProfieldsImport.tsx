'use client';

/**
 * Importação de um time do Jira (Profields): formulário de credenciais, prévia
 * do que será importado e confirmação. Nada é gravado até a confirmação.
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
  project: ProjectDetail;
  /** Papel da própria pessoa na lista importada, se ela foi reconhecida. */
  myRoleName?: string;
  /** Verdadeiro quando o papel dela administra pessoas da squad. */
  leadsPeople: boolean;
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

  useEffect(() => {
    if (jiraSettings) {
      if (jiraSettings.domain && !jiraDomain) setJiraDomain(jiraSettings.domain);
      if (jiraSettings.token && !jiraToken) setJiraToken(jiraSettings.token);
    }
  }, [jiraSettings]);

  const myEmail = (userProfile?.email || '').toLowerCase().trim();
  const isMe = (m: ProjectMemberRoleItem) =>
    (!!userProfile?.id && m.userId === userProfile.id) ||
    (!!myEmail && (m.email || '').toLowerCase().trim() === myEmail);
  const myMembership = syncedProject?.members.find(isMe);

  useEffect(() => {
    onPreviewChange?.(!!syncedProject);
    return () => onPreviewChange?.(false);
  }, [syncedProject, onPreviewChange]);

  const handlePreview = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!jiraKey.trim() || !jiraToken.trim()) {
      toast({ title: 'Informe a chave do projeto e seu token do Jira', variant: 'destructive' });
      return;
    }
    setBusy('jira');
    try {
      const preview = await projectService.previewProjectProfields(
        jiraKey.trim().toUpperCase(), jiraDomain.trim(), jiraToken.trim()
      );
      setSyncedProject(preview);
      toast({ title: 'Dados encontrados no Jira', description: 'Nada foi gravado ainda. Confira e confirme pra importar.' });
    } catch (err: any) {
      toast({ title: 'Falha na sincronização', description: err.message, variant: 'destructive' });
    } finally {
      setBusy(null);
    }
  }, [jiraDomain, jiraKey, jiraToken, toast]);

  const handleConfirm = useCallback(async (body: ProjectImportConfirmBody) => {
    if (!syncedProject) return;
    setBusy('confirm');
    try {
      const saved = await projectService.confirmProjectProfields(syncedProject.id, body, jiraDomain.trim(), jiraToken.trim());
      await switchProject(syncedProject.id);
      if (jiraToken.trim()) {
        await saveJiraSettings({ domain: jiraDomain.trim(), token: jiraToken.trim() });
      }
      const mine = saved.members.find(isMe);
      const leadsPeople = !!mine && (SQUAD_PEOPLE_ADMIN_ROLES as string[]).includes(mine.roleName);
      onImported({ project: saved, myRoleName: mine?.roleName, leadsPeople });
    } catch (err: any) {
      toast({ title: 'Não foi possível importar', description: err.message, variant: 'destructive' });
    } finally {
      setBusy(null);
    }
  }, [syncedProject, jiraDomain, jiraToken, switchProject, saveJiraSettings, isMe, onImported, toast]);

  // Prévia: conferir, editar e escolher antes de gravar
  if (syncedProject) {
    return (
      <JiraImportPreview
        project={syncedProject}
        isMe={isMe}
        busy={busy === 'confirm'}
        onBack={() => setSyncedProject(null)}
        onConfirm={handleConfirm}
      />
    );
  }

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
          <Label htmlFor="jira-chave" className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Projeto no Jira</Label>
          <Input id="jira-chave" name="jiraProjectKey" value={jiraKey} onChange={e => setJiraKey(e.target.value)}
            placeholder="Ex: DDWMISSI" autoComplete="off" data-lpignore="true"
            className="h-11 font-code uppercase rounded-xl" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="jira-token" className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Seu token do Jira</Label>
          <Input id="jira-token" name="jiraPersonalAccessToken" type="password" value={jiraToken}
            onChange={e => setJiraToken(e.target.value)} autoComplete="new-password" data-lpignore="true"
            placeholder="Token de acesso do Jira" className="h-11 font-code rounded-xl" />
        </div>
        <Button type="submit" disabled={busy !== null} className="h-12 rounded-xl font-bold gap-2">
          {busy === 'jira' ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Ver o que vai ser importado <ArrowRight className="w-4 h-4" /></>}
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

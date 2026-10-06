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
import { ArrowRight, Crown, ExternalLink, Loader2, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/AuthContext';
import { useUserContext } from '@/context/UserContext';
import { useJiraSettings } from '@/hooks/useJiraSettings';
import { projectService, type ProjectDetail, type ProjectMemberRoleItem } from '@/services/projectService';
import { SQUAD_PEOPLE_ADMIN_ROLES } from '@/lib/types';
import { cn } from '@/lib/utils';

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
}

function initials(name?: string) {
  const clean = (name || '').trim();
  if (!clean) return '??';
  const parts = clean.split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function Fact({ label, value }: { label: string; value?: string }) {
  return (
    <div className="bg-muted/40 border border-border/40 rounded-xl px-3 py-2 min-w-0">
      <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={cn('text-sm font-semibold truncate', !value && 'text-muted-foreground/60 italic')} title={value || undefined}>
        {value || 'não informado'}
      </div>
    </div>
  );
}

export function JiraProfieldsImport({ initialProjectKey = '', onImported, skipAction, skipHint }: JiraProfieldsImportProps) {
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

  const handleConfirm = useCallback(async () => {
    if (!syncedProject) return;
    setBusy('confirm');
    try {
      await projectService.syncProjectProfields(syncedProject.id, jiraDomain.trim(), jiraToken.trim());
      await switchProject(syncedProject.id);
      if (jiraToken.trim()) {
        await saveJiraSettings({ domain: jiraDomain.trim(), token: jiraToken.trim() });
      }
      const leadsPeople = !!myMembership && (SQUAD_PEOPLE_ADMIN_ROLES as string[]).includes(myMembership.roleName);
      onImported({ project: syncedProject, myRoleName: myMembership?.roleName, leadsPeople });
    } catch (err: any) {
      toast({ title: 'Não foi possível importar', description: err.message, variant: 'destructive' });
    } finally {
      setBusy(null);
    }
  }, [syncedProject, jiraDomain, jiraToken, switchProject, saveJiraSettings, myMembership, onImported, toast]);

  // Prévia: conferir antes de gravar
  if (syncedProject) {
    return (
      <div className="w-full bg-card/80 backdrop-blur-xl border border-border/60 rounded-3xl p-6 flex flex-col gap-5">
        <p className="text-sm text-muted-foreground leading-relaxed">
          Prévia do Profields de <span className="font-code font-bold">{syncedProject.id}</span>. Nada foi gravado ainda:
          só ao confirmar o projeto e as pessoas entram no sistema.
        </p>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
          {[
            { label: 'Projeto', value: syncedProject.name },
            { label: 'Segmento', value: syncedProject.segmentName },
            { label: 'Tribo', value: syncedProject.tribeName },
            { label: 'Localidade', value: syncedProject.locality },
            { label: 'VP', value: syncedProject.vicePresident },
            { label: 'Área VP', value: syncedProject.vpArea },
            { label: 'Status', value: syncedProject.status },
            { label: 'Dev Team', value: syncedProject.devTeamSize ? `${syncedProject.devTeamSize} pessoas` : '' },
          ].map(f => <Fact key={f.label} label={f.label} value={f.value} />)}
        </div>

        <div className="space-y-2">
          <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5" /> Pessoas encontradas ({syncedProject.members.length})
          </Label>
          {syncedProject.members.length === 0 ? (
            <div className="text-xs text-muted-foreground bg-muted/40 border border-border/40 rounded-xl p-4 text-center">
              O Profields não retornou nenhuma pessoa cadastrada para este projeto.
            </div>
          ) : (
            <div className="border border-border/40 rounded-xl overflow-hidden">
              <div className="max-h-64 overflow-y-auto divide-y divide-border/40">
                {syncedProject.members.map((m, i) => (
                  <div key={m.id || `${m.roleKey}-${m.email || m.displayName}-${i}`}
                    className={cn('flex items-center gap-3 px-3 py-2 text-sm', isMe(m) && 'bg-primary/5')}>
                    <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-[10px] font-bold text-muted-foreground shrink-0">
                      {initials(m.displayName)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold truncate flex items-center gap-2">
                        {m.displayName}
                        {isMe(m) && <Badge className="text-[9px] px-1.5 py-0 h-4">Você</Badge>}
                      </div>
                    </div>
                    <Badge variant="outline" className="text-[10px] shrink-0 gap-1">
                      {m.leadership && <Crown className="w-3 h-3 text-amber-500" />}
                      {m.roleName}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          )}
          {!myMembership && (
            <p className="text-[11px] text-amber-600 dark:text-amber-400 leading-relaxed">
              Seu e-mail não apareceu entre as pessoas do Profields. Depois de importar, você se marca na lista
              do time — é o mesmo "sou eu" do passo anterior.
            </p>
          )}
        </div>

        <div className="flex flex-col sm:flex-row gap-2 sm:justify-end">
          <Button variant="outline" onClick={() => setSyncedProject(null)} disabled={busy !== null} className="h-11 rounded-xl text-xs font-bold">
            Corrigir dados
          </Button>
          <Button onClick={handleConfirm} disabled={busy !== null} className="h-11 rounded-xl text-xs font-bold gap-2">
            {busy === 'confirm' ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Confirmar e importar <ArrowRight className="w-4 h-4" /></>}
          </Button>
        </div>
      </div>
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

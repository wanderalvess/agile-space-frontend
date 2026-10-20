'use client';

import { useRef, useState } from 'react';
import { Copy, Link2 } from 'lucide-react';
import { Modal, ModalButton, SelectField, TabBar, FIELD, PRIMARY_BUTTON } from '@/components/room-kit';
import { useToast } from '@/hooks/use-toast';
import {
  INVITE_EXPIRATION_DAYS,
  INVITE_ROLES,
  TEAM_INVITE_DEFAULT_DAYS,
  TEAM_INVITE_DEFAULT_MAX_USES,
  TEAM_INVITE_MAX_DAYS,
  TEAM_INVITE_MAX_USES,
} from '@/lib/roster/constants';
import { isValidInviteEmail, validateTeamInvite } from '@/lib/roster/invites';
import { cn } from '@/lib/utils';
import { BatchInviteForm } from './BatchInviteForm';
import { useBatchInvites } from './hooks/useBatchInvites';
import { FIELD_40, ICON_STROKE } from './styles';

const ROLE_OPTIONS = INVITE_ROLES.map((r) => ({ value: r, label: r }));
const TABS = [
  { id: 'one', label: 'Uma pessoa' },
  { id: 'batch', label: 'Em lote' },
  { id: 'team', label: 'Equipe' },
] as const;
type Tab = (typeof TABS)[number]['id'];

interface InviteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  squadId: string;
  create: (role: string, email?: string) => Promise<string>;
  /** Convite de equipe: maxUses null = sem limite (só ADMIN). */
  createTeam: (role: string, maxUses: number | null, validityDays: number) => Promise<string>;
  /** ADMIN pode deixar o limite de pessoas vazio (sem limite). */
  canUnlimited?: boolean;
  copyLink: (link: string) => void;
  onCreated: () => void;
}

/**
 * Convidar por link. Uma pessoa: e-mail opcional (vazio = link aberto) e papel entre os que o servidor aceita;
 * a validade é fixa em 7 dias (somente leitura). Em lote: ver BatchInviteForm. Equipe: um único link para várias
 * pessoas, com papel, limite de pessoas e validade (ver validateTeamInvite).
 */
export function InviteDialog(props: InviteDialogProps) {
  const { open, onOpenChange, squadId, create, createTeam, canUnlimited = false, copyLink, onCreated } = props;
  const { toast } = useToast();
  const [tab, setTab] = useState<Tab>('one');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<string>('Developer');
  const [link, setLink] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [teamMax, setTeamMax] = useState(String(TEAM_INVITE_DEFAULT_MAX_USES));
  const [teamDays, setTeamDays] = useState(String(TEAM_INVITE_DEFAULT_DAYS));
  const [linkDays, setLinkDays] = useState(INVITE_EXPIRATION_DAYS);
  const [teamShown, setTeamShown] = useState(false);
  const batchInputRef = useRef<HTMLInputElement>(null);
  const batch = useBatchInvites({ squadId, create: (r, e) => create(r, e), onFinished: onCreated, inputRef: batchInputRef });

  const emailTrim = email.trim();
  const emailInvalid = emailTrim.length > 0 && !isValidInviteEmail(emailTrim);
  const teamCheck = validateTeamInvite(teamMax, teamDays, canUnlimited);
  const isTeam = tab === 'team';

  const reset = () => {
    setTab('one');
    setEmail('');
    setRole('Developer');
    setLink(null);
    setTeamMax(String(TEAM_INVITE_DEFAULT_MAX_USES));
    setTeamDays(String(TEAM_INVITE_DEFAULT_DAYS));
    setLinkDays(INVITE_EXPIRATION_DAYS);
    setTeamShown(false);
    batch.reset();
  };
  const close = () => {
    onOpenChange(false);
    // Só limpa depois da animação de saída, para o conteúdo não piscar.
    setTimeout(reset, 250);
  };

  const submit = async () => {
    setCreating(true);
    try {
      if (isTeam) {
        if (!teamCheck.ok) return;
        setLink(await createTeam(role, teamCheck.maxUses, teamCheck.days));
        setLinkDays(teamCheck.days);
        setTeamShown(true);
      } else {
        setLink(await create(role, emailTrim || undefined));
        setLinkDays(INVITE_EXPIRATION_DAYS);
        setTeamShown(false);
      }
      onCreated();
      toast({ title: 'Convite gerado', description: isTeam ? 'Copie o link e envie para a equipe.' : 'Copie o link e envie para a pessoa convidada.' });
    } catch (err: unknown) {
      toast({ title: 'Erro ao gerar convite', description: (err as Error)?.message || 'Tente novamente.', variant: 'destructive' });
    } finally {
      setCreating(false);
    }
  };

  const showTabs = !link && batch.phase !== 'running';
  const isBatch = tab === 'batch' && !link;

  return (
    <Modal
      open={open}
      onOpenChange={(o) => { if (!o) close(); else onOpenChange(true); }}
      size={isBatch ? 'lg' : 'md'}
      icon={Link2}
      title={isBatch ? 'Convidar em lote' : isTeam && !link ? 'Convite para a equipe' : 'Convidar por link'}
      description={link || isBatch ? undefined : isTeam ? 'Um único link para várias pessoas entrarem nesta squad com o papel escolhido.' : 'Vincula a pessoa a esta squad com o papel escolhido, mesmo se o e-mail não bater com o do Jira.'}
      bodyClassName="pt-4"
      preventClose={creating || batch.phase === 'running'}
      headerExtra={showTabs ? <TabBar tabs={TABS} value={tab} onChange={setTab} label="Tipo de convite" idPrefix="invite" className="px-6" /> : undefined}
      footer={
        isBatch ? undefined : link ? (
          <ModalButton onClick={close}>Fechar</ModalButton>
        ) : (
          <>
            <ModalButton disabled={creating} onClick={close}>Cancelar</ModalButton>
            <ModalButton variant="primary" disabled={creating || (isTeam ? !teamCheck.ok : emailInvalid)} onClick={submit}>
              <Link2 className="h-4 w-4" strokeWidth={ICON_STROKE} aria-hidden="true" />
              {creating ? 'Gerando…' : 'Gerar link'}
            </ModalButton>
          </>
        )
      }
    >
      {isBatch ? (
        <BatchInviteForm batch={batch} inputRef={batchInputRef} onCopy={copyLink} onClose={close} />
      ) : link ? (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <span className="text-[13px] font-semibold text-muted-foreground">Link do convite (expira em {linkDays} dias)</span>
            <div className="flex items-center gap-2">
              <code className="flex h-11 min-w-0 flex-1 items-center overflow-hidden text-ellipsis whitespace-nowrap rounded-[10px] border border-border bg-muted/40 px-3 text-[13px] text-foreground">
                {link}
              </code>
              <button
                type="button"
                aria-label="Copiar link"
                onClick={() => copyLink(link)}
                className={cn('inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[10px] transition-colors duration-fast focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring', PRIMARY_BUTTON)}
              >
                <Copy className="h-[18px] w-[18px]" strokeWidth={ICON_STROKE} aria-hidden="true" />
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <ModalButton disabled className="h-9 text-[13px]">Enviar por e-mail</ModalButton>
              <span className="text-xs text-muted-foreground">em breve</span>
            </div>
          </div>
          <p className="text-[13px] leading-relaxed text-muted-foreground">
            {teamShown
              ? `Envie no canal da equipe. Cada pessoa entra ou cria conta e já cai na squad como ${role}; a mesma conta não gasta duas vagas. Você pode revogar o link a qualquer momento: quem já entrou continua.`
              : `Envie por e-mail, WhatsApp ou Slack. Ao abrir, a pessoa entra ou cria conta e já cai na squad como ${role}.`}
          </p>
          <div role="status" className="flex flex-col gap-0.5 rounded-xl border border-border bg-muted/40 px-3.5 py-2.5">
            <span className="text-[13px] font-bold text-foreground">Convite gerado</span>
            <span className="text-xs text-muted-foreground">{teamShown ? 'Copie o link e envie para a equipe.' : 'Copie o link e envie para a pessoa convidada.'}</span>
          </div>
        </div>
      ) : isTeam ? (
        <div className="flex flex-col gap-3.5">
          <p className="text-[13px] font-bold text-foreground">Convite para a equipe (link para várias pessoas)</p>
          <label className="flex flex-col gap-1.5 text-[13px] font-semibold text-muted-foreground">
            Papel na squad
            <SelectField aria-label="Papel na squad" value={role} onChange={setRole} options={ROLE_OPTIONS} className={cn(FIELD, 'h-10 text-sm')} />
          </label>
          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5 text-[13px] font-semibold text-muted-foreground">
              Limite de pessoas
              <input
                type="number"
                inputMode="numeric"
                min={1}
                max={TEAM_INVITE_MAX_USES}
                value={teamMax}
                onChange={(e) => setTeamMax(e.target.value)}
                placeholder={canUnlimited ? 'Vazio = sem limite' : String(TEAM_INVITE_DEFAULT_MAX_USES)}
                className={FIELD_40}
              />
            </label>
            <label className="flex flex-col gap-1.5 text-[13px] font-semibold text-muted-foreground">
              Validade (dias)
              <input
                type="number"
                inputMode="numeric"
                min={1}
                max={TEAM_INVITE_MAX_DAYS}
                value={teamDays}
                onChange={(e) => setTeamDays(e.target.value)}
                className={FIELD_40}
              />
            </label>
          </div>
          {!teamCheck.ok && (
            <span role="alert" className="text-xs font-normal text-red-700 dark:text-red-300">{teamCheck.error}</span>
          )}
          <p className="text-xs text-muted-foreground">
            Liderança não é concedida por link. Quem já faz parte da squad não gasta vaga, e você pode revogar o link quando quiser.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3.5">
          <label className="flex flex-col gap-1.5 text-[13px] font-semibold text-muted-foreground">
            E-mail (opcional; vazio gera um link aberto)
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="pessoa@empresa.com"
              aria-invalid={emailInvalid || undefined}
              className={cn(FIELD_40, emailInvalid && 'border-red-500/70')}
            />
            {emailInvalid && <span role="alert" className="text-xs font-normal text-red-700 dark:text-red-300">Esse e-mail não parece válido.</span>}
          </label>
          <label className="flex flex-col gap-1.5 text-[13px] font-semibold text-muted-foreground">
            Papel na squad
            <SelectField aria-label="Papel na squad" value={role} onChange={setRole} options={ROLE_OPTIONS} className={cn(FIELD, 'h-10 text-sm')} />
          </label>
          <div className="flex items-center gap-2.5 rounded-xl border border-border px-3.5 py-2.5 text-sm text-foreground">
            Expira em {INVITE_EXPIRATION_DAYS} dias
            <span className="text-xs text-muted-foreground">(definido pelo servidor)</span>
          </div>
        </div>
      )}
    </Modal>
  );
}

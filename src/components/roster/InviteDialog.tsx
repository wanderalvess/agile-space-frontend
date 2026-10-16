'use client';

import { useRef, useState } from 'react';
import { Copy, Link2 } from 'lucide-react';
import { Modal, ModalButton, SelectField, TabBar, FIELD, PRIMARY_BUTTON } from '@/components/room-kit';
import { useToast } from '@/hooks/use-toast';
import { INVITE_EXPIRATION_DAYS, INVITE_ROLES } from '@/lib/roster/constants';
import { isValidInviteEmail } from '@/lib/roster/invites';
import { cn } from '@/lib/utils';
import { BatchInviteForm } from './BatchInviteForm';
import { useBatchInvites } from './hooks/useBatchInvites';
import { FIELD_40, ICON_STROKE } from './styles';

const ROLE_OPTIONS = INVITE_ROLES.map((r) => ({ value: r, label: r }));
const TABS = [
  { id: 'one', label: 'Uma pessoa' },
  { id: 'batch', label: 'Em lote' },
] as const;
type Tab = (typeof TABS)[number]['id'];

interface InviteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  squadId: string;
  create: (role: string, email?: string) => Promise<string>;
  copyLink: (link: string) => void;
  onCreated: () => void;
}

/**
 * Convidar por link. Uma pessoa: e-mail opcional (vazio = link aberto) e papel entre os que o servidor aceita;
 * a validade é fixa em 7 dias (somente leitura). Em lote: ver BatchInviteForm.
 */
export function InviteDialog(props: InviteDialogProps) {
  const { open, onOpenChange, squadId, create, copyLink, onCreated } = props;
  const { toast } = useToast();
  const [tab, setTab] = useState<Tab>('one');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<string>('Developer');
  const [link, setLink] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const batchInputRef = useRef<HTMLInputElement>(null);
  const batch = useBatchInvites({ squadId, create: (r, e) => create(r, e), onFinished: onCreated, inputRef: batchInputRef });

  const emailTrim = email.trim();
  const emailInvalid = emailTrim.length > 0 && !isValidInviteEmail(emailTrim);

  const reset = () => {
    setTab('one');
    setEmail('');
    setRole('Developer');
    setLink(null);
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
      setLink(await create(role, emailTrim || undefined));
      onCreated();
      toast({ title: 'Convite gerado', description: 'Copie o link e envie para a pessoa convidada.' });
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
      title={isBatch ? 'Convidar em lote' : 'Convidar por link'}
      description={link || isBatch ? undefined : 'Vincula a pessoa a esta squad com o papel escolhido, mesmo se o e-mail não bater com o do Jira.'}
      bodyClassName="pt-4"
      preventClose={creating || batch.phase === 'running'}
      headerExtra={showTabs ? <TabBar tabs={TABS} value={tab} onChange={setTab} label="Tipo de convite" idPrefix="invite" className="px-6" /> : undefined}
      footer={
        isBatch ? undefined : link ? (
          <ModalButton onClick={close}>Fechar</ModalButton>
        ) : (
          <>
            <ModalButton disabled={creating} onClick={close}>Cancelar</ModalButton>
            <ModalButton variant="primary" disabled={creating || emailInvalid} onClick={submit}>
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
            <span className="text-[13px] font-semibold text-muted-foreground">Link do convite (expira em {INVITE_EXPIRATION_DAYS} dias)</span>
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
            Envie por e-mail, WhatsApp ou Slack. Ao abrir, a pessoa entra ou cria conta e já cai na squad como {role}.
          </p>
          <div role="status" className="flex flex-col gap-0.5 rounded-xl border border-border bg-muted/40 px-3.5 py-2.5">
            <span className="text-[13px] font-bold text-foreground">Convite gerado</span>
            <span className="text-xs text-muted-foreground">Copie o link e envie para a pessoa convidada.</span>
          </div>
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

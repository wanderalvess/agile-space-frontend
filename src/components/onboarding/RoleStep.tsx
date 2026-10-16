'use client';

import { Code2, Crown, Eye, PenTool, type LucideIcon } from 'lucide-react';
import { TONES } from '@/components/room-kit/tokens';
import { cn } from '@/lib/utils';
import { BackButton, ChoiceCard, InlineNotice, SmallButton, StepCard, StepHeading } from './ui';

/**
 * Papéis em linguagem de gente. O valor é um papel de CONTRIBUTOR_ROLES — os de liderança não estão
 * aqui de propósito: o backend recusa autodeclaração deles (JiraProfieldsService.SELF_SERVICE_JOIN_ROLE_NAMES).
 */
export const ROLE_CHOICES: ReadonlyArray<{ role: string; icon: LucideIcon; title: string; description: string; hint: string }> = [
  { role: 'Developer', icon: Code2, title: 'Eu construo', description: 'Dev, QA, mobile, dados. Pega card, estima, entrega.', hint: 'Entra no poker, na daily e no board' },
  { role: 'Designer', icon: PenTool, title: 'Eu desenho', description: 'Design, UX, pesquisa. Trabalha com a squad, não no backlog.', hint: 'Entra no brainstorming e no showcase' },
  { role: 'Stakeholder / Observador', icon: Eye, title: 'Eu acompanho', description: 'Stakeholder, SME, gestão. Quer ver o andamento, sem ruído.', hint: 'Vê o painel e os showcases' },
];

interface Props {
  projectId: string;
  /** Papel que está sendo enviado ao servidor (o cartão mostra o giro). */
  joiningRole: string | null;
  /** O servidor recusou a entrada (403): o caminho passa a ser convite ou pedido de vínculo. */
  refused: boolean;
  onPick: (role: string) => void;
  onOpenInvite: () => void;
  onRequestLink: () => void;
  onBack: () => void;
}

/** Passo 5: papel de quem não está na lista. Liderança não aparece aqui: vem do Jira ou de convite. */
export function RoleStep({ projectId, joiningRole, refused, onPick, onOpenInvite, onRequestLink, onBack }: Props) {
  const busy = joiningRole !== null;
  return (
    <StepCard>
      <StepHeading title={`Como você participa da ${projectId}?`} subtitle="Só pra saber o que te mostrar primeiro. A squad pode ajustar isso depois." />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {ROLE_CHOICES.map((choice) => (
          <ChoiceCard
            key={choice.role}
            icon={choice.icon}
            title={choice.title}
            description={choice.description}
            hint={choice.hint}
            busy={joiningRole === choice.role}
            disabled={busy}
            onClick={() => onPick(choice.role)}
          />
        ))}
      </div>

      <div className={cn('flex items-start gap-3 rounded-xl border bg-muted/40 px-3.5 py-3', 'border-amber-500/30')}>
        <Crown aria-hidden="true" className={cn('mt-0.5 h-[18px] w-[18px] shrink-0', TONES.warn.text)} strokeWidth={1.5} />
        <span className="text-[13px] leading-relaxed text-muted-foreground">
          É PO, Tech Lead ou Agile Master da squad? Esses papéis vêm do Jira ou de um convite. Para entrar na {projectId} é preciso constar na lista ou ter convite da liderança.
        </span>
      </div>

      {refused && (
        <InlineNotice
          role="alert"
          tone="danger"
          actions={
            <>
              <SmallButton onClick={onOpenInvite}>Tenho um link de convite</SmallButton>
              <SmallButton onClick={onRequestLink}>Pedir vínculo</SmallButton>
            </>
          }
        >
          O servidor recusou a entrada. O caminho é o convite ou um pedido de vínculo.
        </InlineNotice>
      )}

      <BackButton onClick={onBack} disabled={busy}>
        Voltar pra lista
      </BackButton>
    </StepCard>
  );
}

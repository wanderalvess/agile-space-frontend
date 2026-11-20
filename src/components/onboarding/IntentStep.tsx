'use client';

import { Crown, Search } from 'lucide-react';
import { BackButton, ChoiceCard, StepCard, StepHeading } from './ui';

interface Props {
  /** "Voltar" só existe quando a tela anterior (sugestão) existiu. */
  canGoBack: boolean;
  onLead: () => void;
  onParticipate: () => void;
  onBack: () => void;
}

/** Passo 2: separa quem cadastra squads (Agile Master e People Lead) de quem participa. */
export function IntentStep({ canGoBack, onLead, onParticipate, onBack }: Props) {
  return (
    <StepCard>
      <StepHeading title="Como você usa o Portal Tech V&D?" subtitle="Isso define o que a gente te mostra primeiro. Nada é gravado agora." />
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
        <ChoiceCard
          emphasis
          icon={Crown}
          title="Sou Agile Master ou People Lead"
          description="Cuido de uma ou mais squads. Importo todas do Jira de uma vez, ou crio uma nova."
          hint="Só AM e PL cadastram squads"
          onClick={onLead}
        />
        <ChoiceCard
          icon={Search}
          title="Participo de uma squad"
          description="Dev, QA, design, PO, stakeholder. Procuro a minha squad e entro nela."
          hint="A squad precisa já estar cadastrada"
          onClick={onParticipate}
        />
      </div>
      {canGoBack && <BackButton onClick={onBack}>Voltar</BackButton>}
    </StepCard>
  );
}

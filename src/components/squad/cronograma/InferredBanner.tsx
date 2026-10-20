'use client';

import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { WARN_BOX, WARN_TEXT } from './styles';

interface Props {
  inferred: number;
  total: number;
  /** A sugestão pelas horas já está ligada. */
  suggesting: boolean;
  /** Quem pode escolher os campos de data (configurar a squad). */
  canConfigure: boolean;
  onSuggest: () => void;
  onChooseFields: () => void;
}

/** Faixa de aviso: as subtarefas visíveis não trazem início e fim reais do Jira. */
export function InferredBanner({ inferred, total, suggesting, canConfigure, onSuggest, onChooseFields }: Props) {
  const all = inferred === total;
  return (
    <div role="status" className={`flex flex-wrap items-center gap-3 rounded-2xl p-4 text-sm ${WARN_BOX}`}>
      <AlertTriangle className={`h-[18px] w-[18px] shrink-0 ${WARN_TEXT}`} strokeWidth={1.5} aria-hidden="true" />
      <p className="min-w-[260px] flex-1 leading-relaxed text-foreground">
        <strong>
          {all
            ? 'As subtarefas desta sprint estão sem "Data e Hora de Início" e "Data e Hora de Fim" no Jira.'
            : `${inferred} de ${total} subtarefas estão sem "Data e Hora de Início" e "Data e Hora de Fim" no Jira.`}
        </strong>{' '}
        As barras tracejadas usam a data de criação e a de última edição, que não dizem quando o trabalho deve acontecer.
        Por isso o portal não declara atraso. Preencha os campos ou use a sugestão pelas horas: cada fase começa quando a
        anterior termina e cada pessoa segue a própria capacidade diária.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={onSuggest} disabled={suggesting} className="h-10 rounded-xl px-4 font-semibold">
          {suggesting ? 'Sugestão ligada' : 'Sugerir pelas horas'}
        </Button>
        {canConfigure && (
          <Button type="button" variant="outline" onClick={onChooseFields} className="h-10 rounded-xl px-4 font-semibold">
            Escolher os campos de data
          </Button>
        )}
      </div>
    </div>
  );
}

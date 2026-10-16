'use client';

import { RefreshCw, Save, SlidersHorizontal } from 'lucide-react';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet';
import { ModalButton, SidePanel, FIELD } from '@/components/room-kit';
import type { CalcMethod } from '@/lib/roster/constants';
import { cn } from '@/lib/utils';
import { DecimalInput } from './DecimalInput';
import type { useRosterRule } from './hooks/useRosterRule';
import { ICON_STROKE } from './styles';

interface MethodDef {
  key: CalcMethod;
  title: string;
}

const METHODS: MethodDef[] = [
  { key: 'STANDARD', title: 'Padrão fixo da squad (ex.: 8h/dia)' },
  { key: 'JIRA_WORKLOG_AVERAGE', title: 'Média de worklogs do Jira (JQL)' },
  { key: 'CUSTOM_FORMULA', title: 'Fator de foco (desconto de reuniões/cerimônias)' },
];

function FieldLabel({ label, hint, children, error }: { label: string; hint?: string; children: React.ReactNode; error?: string }) {
  return (
    <label className="flex flex-col gap-1.5 text-[13px] font-semibold text-foreground">
      <span className="flex items-baseline justify-between gap-2">
        {label}
        {hint && <span className="text-xs font-normal text-muted-foreground">{hint}</span>}
      </span>
      {children}
      {error && <span role="alert" className="text-xs font-normal text-red-700 dark:text-red-300">{error}</span>}
    </label>
  );
}

interface RuleSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rule: ReturnType<typeof useRosterRule>;
  jqlPlaceholder: string;
}

/**
 * Regra de cálculo automático das horas sugeridas, em painel lateral. Três métodos, cada um com seus campos:
 * padrão fixo (carga base), média de worklogs (JQL) e fator de foco (fator + carga base). O fator aceita
 * "0,85" ou "0.85".
 */
export function RuleSheet({ open, onOpenChange, rule, jqlPlaceholder }: RuleSheetProps) {
  const busy = rule.isSaving || rule.isRecalculating;
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-[480px] [&>button]:hidden">
        <SheetTitle className="sr-only">Regra de cálculo automático</SheetTitle>
        <SheetDescription className="sr-only">Como o sistema calcula as horas sugeridas para cada integrante</SheetDescription>
        <SidePanel
          title="Regra de cálculo automático"
          icon={SlidersHorizontal}
          onClose={() => onOpenChange(false)}
          flush={false}
          bodyClassName="gap-4 overflow-y-auto"
          footer={
            <div className="flex flex-wrap justify-end gap-2">
              <ModalButton disabled={busy || !rule.canSubmit} onClick={rule.recalculate}>
                <RefreshCw className={cn('h-4 w-4', rule.isRecalculating && 'animate-spin motion-reduce:animate-none')} strokeWidth={ICON_STROKE} aria-hidden="true" />
                Recalcular horas sugeridas
              </ModalButton>
              <ModalButton variant="primary" disabled={busy || !rule.canSubmit} onClick={rule.save}>
                <Save className="h-4 w-4" strokeWidth={ICON_STROKE} aria-hidden="true" />
                {rule.isSaving ? 'Salvando…' : 'Salvar regra'}
              </ModalButton>
            </div>
          }
        >
          <p className="text-[13px] text-muted-foreground">
            Defina como o sistema pré-calcula as horas sugeridas de cada integrante. O gestor sempre pode informar o valor real final.
          </p>
          <div role="radiogroup" aria-label="Método de cálculo" className="flex flex-col gap-2">
            {METHODS.map((m) => {
              const on = rule.method === m.key;
              return (
                <div key={m.key} className={cn('flex flex-col gap-3 rounded-xl border p-3.5 transition-colors duration-fast', on ? 'border-primary/60 bg-primary/10 dark:bg-primary/15' : 'border-border')}>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => rule.setMethod(m.key)}
                    className="flex items-center gap-3 rounded-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <span className={cn('flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border-2', on ? 'border-primary' : 'border-border')}>
                      <span className={cn('h-2 w-2 rounded-full', on ? 'bg-primary' : 'bg-transparent')} />
                    </span>
                    <span className="text-sm font-bold text-foreground">{m.title}</span>
                  </button>
                  {on && m.key === 'STANDARD' && (
                    <FieldLabel label="Carga horária padrão (h/dia)" hint="1–24" error={rule.baseValid ? undefined : 'Informe horas por dia entre 1 e 24.'}>
                      <DecimalInput aria-label="Carga horária padrão em horas por dia" value={rule.baseText} onValueChange={rule.setBaseText} invalid={!rule.baseValid} className={cn(FIELD, 'h-10')} />
                    </FieldLabel>
                  )}
                  {on && m.key === 'JIRA_WORKLOG_AVERAGE' && (
                    <FieldLabel label="Consulta JQL para média de horas">
                      <input value={rule.jql} onChange={(e) => rule.setJql(e.target.value)} placeholder={jqlPlaceholder} className={cn(FIELD, 'h-10 font-mono text-[13px]')} />
                    </FieldLabel>
                  )}
                  {on && m.key === 'CUSTOM_FORMULA' && (
                    <>
                      <FieldLabel label="Fator de foco" hint="0,85 = 85% produção / 15% reuniões" error={rule.focusValid ? undefined : 'Informe um valor entre 0 e 1, com vírgula ou ponto (ex.: 0,85).'}>
                        <DecimalInput aria-label="Fator de foco" value={rule.focusText} onValueChange={rule.setFocusText} invalid={!rule.focusValid} placeholder="0,85" className={cn(FIELD, 'h-10 font-mono text-[13px]')} />
                      </FieldLabel>
                      <FieldLabel label="Carga base (h/dia)" hint="1–24" error={rule.baseValid ? undefined : 'Informe horas por dia entre 1 e 24.'}>
                        <DecimalInput aria-label="Carga base em horas por dia" value={rule.baseText} onValueChange={rule.setBaseText} invalid={!rule.baseValid} className={cn(FIELD, 'h-10')} />
                      </FieldLabel>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </SidePanel>
      </SheetContent>
    </Sheet>
  );
}

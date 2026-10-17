'use client';

import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, ArrowLeft, X, Sparkles } from 'lucide-react';
import { ModalButton } from '@/components/room-kit';

interface TourStep {
  target: string | null; // valor do atributo data-tour; null = passo de boas-vindas, sem alvo
  title: string;
  desc: string;
}

const STEPS: TourStep[] = [
  {
    target: null,
    title: 'Bem-vindo à Review',
    desc: 'Tour rápido de 5 passos para você saber de onde vem cada informação e o que fazer nos seus cards.',
  },
  {
    target: 'search',
    title: 'Ache os seus cards',
    desc: 'Busque por chave, título, dev ou QA, ou use os filtros de Dev, QA e Tipo ao lado para ver só o que é seu.',
  },
  {
    target: 'first-card-status',
    title: 'Problema e solução já vêm do Jira',
    desc: 'O sistema tenta extrair isso sozinho da descrição da issue. Complete a evidência (print ou vídeo) e marque o status aqui conforme avança. Quando marcar "Pronta", o card recolhe sozinho; clique nele para reabrir se precisar reconferir algo.',
  },
  {
    target: 'jira-import',
    title: 'Importação do Jira',
    desc: 'Normalmente o PO ou o agilista já trouxe as issues para cá. Em "Adicionar" você importa mais issues do Jira ou cria um card manual, se precisar.',
  },
  {
    target: 'start-teatro',
    title: 'Apresente no Modo Teatro',
    desc: 'Com os cards prontos, clique aqui para apresentar em tela cheia, sem sair da ferramenta.',
  },
];

/** Guarda no navegador que o tour já foi visto (o tour abre sozinho na primeira vez com cards). */
export const TOUR_STORAGE_KEY = 'agileSpace_showcase_tour_v1';

const PAD = 8;
const TOOLTIP_WIDTH = 320;

interface ShowcaseTourProps {
  open: boolean;
  onClose: () => void;
}

export function ShowcaseTour({ open, onClose }: ShowcaseTourProps) {
  const [stepIndex, setStepIndex] = React.useState(0);
  const [rect, setRect] = React.useState<DOMRect | null>(null);
  // Sentido da navegação (1 = avançando, -1 = voltando). O auto-skip de alvo
  // ausente segue essa direção — senão "Voltar" numa sessão vazia (sem os
  // passos de busca/card) fica preso: pula pra trás, não acha, pula de volta
  // pra frente, e o botão parece não fazer nada.
  const dirRef = React.useRef<1 | -1>(1);

  const step = STEPS[stepIndex];

  const finish = React.useCallback(() => {
    try { localStorage.setItem(TOUR_STORAGE_KEY, 'done'); } catch { /* localStorage indisponível */ }
    setStepIndex(0);
    onClose();
  }, [onClose]);

  const measure = React.useCallback(() => {
    if (!step?.target) { setRect(null); return; }
    const el = document.querySelector(`[data-tour="${step.target}"]`);
    if (!el) {
      // Alvo não existe agora (sem cards, filtro escondeu, layout mudou) — não trava o tour.
      setStepIndex((i) => {
        const next = i + dirRef.current;
        if (next < 0) return 0;
        if (next > STEPS.length - 1) { finish(); return i; }
        return next;
      });
      return;
    }
    setRect(el.getBoundingClientRect());
  }, [step, finish]);

  React.useEffect(() => {
    if (!open) return;
    const el = step?.target ? document.querySelector(`[data-tour="${step.target}"]`) : null;
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    const t = setTimeout(measure, el ? 320 : 0);
    return () => clearTimeout(t);
  }, [open, stepIndex, step, measure]);

  React.useEffect(() => {
    if (!open) return;
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => {
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
    };
  }, [open, measure]);

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') finish();
      if (e.key === 'ArrowRight') { dirRef.current = 1; setStepIndex((i) => Math.min(i + 1, STEPS.length - 1)); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, finish]);

  if (!open) return null;

  const next = () => { dirRef.current = 1; stepIndex < STEPS.length - 1 ? setStepIndex(stepIndex + 1) : finish(); };
  const prev = () => { dirRef.current = -1; setStepIndex((i) => Math.max(0, i - 1)); };

  let tooltipStyle: React.CSSProperties;
  if (rect) {
    const spaceBelow = window.innerHeight - rect.bottom;
    const top = spaceBelow > 220 ? rect.bottom + 16 : Math.max(16, rect.top - 216);
    const left = Math.min(Math.max(rect.left, 16), window.innerWidth - TOOLTIP_WIDTH - 16);
    tooltipStyle = { top, left, width: TOOLTIP_WIDTH };
  } else {
    tooltipStyle = { top: '50%', left: '50%', width: TOOLTIP_WIDTH, transform: 'translate(-50%, -50%)' };
  }

  return (
    <div className="fixed inset-0 z-[100]">
      <div className="absolute inset-0" onClick={finish} />

      {rect ? (
        <motion.div
          className="pointer-events-none fixed rounded-2xl ring-2 ring-primary"
          animate={{
            top: rect.top - PAD, left: rect.left - PAD,
            width: rect.width + PAD * 2, height: rect.height + PAD * 2,
          }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          style={{ boxShadow: '0 0 0 9999px rgba(0, 24, 36, 0.78)' }}
        />
      ) : (
        <div className="fixed inset-0 bg-[#001824]/80" />
      )}

      <AnimatePresence mode="wait">
        <motion.div
          key={stepIndex}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.18 }}
          role="dialog" aria-label="Tour da Review" className="fixed flex flex-col gap-3 rounded-2xl border border-border bg-card p-5 text-card-foreground shadow-2xl"
          style={tooltipStyle}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2 text-primary [.theme-totvs:not(.dark)_&]:text-foreground">
              <Sparkles className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
              <span className="text-xs font-semibold tabular-nums">{stepIndex + 1} / {STEPS.length}</span>
            </div>
            <button onClick={finish} className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" title="Pular tour" aria-label="Pular tour">
              <X className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
            </button>
          </div>
          <h4 className="m-0 text-base font-bold text-foreground">{step.title}</h4>
          <p className="m-0 text-[13px] leading-relaxed text-muted-foreground">{step.desc}</p>
          <div className="flex items-center justify-between pt-2">
            <button onClick={finish} className="rounded-md px-1 text-[13px] font-semibold text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring max-sm:min-h-11">
              Pular tour
            </button>
            <div className="flex items-center gap-2">
              {stepIndex > 0 && (
                <ModalButton variant="ghost" className="h-9 gap-1.5 px-3 text-[13px]" onClick={prev}>
                  <ArrowLeft className="h-3 w-3" strokeWidth={1.75} aria-hidden="true" /> Voltar
                </ModalButton>
              )}
              <ModalButton variant="primary" className="h-9 gap-1.5 px-4 text-[13px]" onClick={next}>
                {stepIndex < STEPS.length - 1 ? <>Próximo <ArrowRight className="h-3 w-3" strokeWidth={1.75} aria-hidden="true" /></> : 'Concluir'}
              </ModalButton>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

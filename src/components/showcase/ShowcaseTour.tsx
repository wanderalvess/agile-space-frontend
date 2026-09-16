'use client';

import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, ArrowLeft, X, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface TourStep {
  target: string | null; // valor do atributo data-tour; null = passo de boas-vindas, sem alvo
  title: string;
  desc: string;
}

const STEPS: TourStep[] = [
  {
    target: null,
    title: 'Bem-vindo à sessão',
    desc: 'Tour rápido de 4 passos pra você já saber de onde vem cada informação e o que fazer nos seus cards.',
  },
  {
    target: 'search',
    title: 'Ache os seus cards',
    desc: 'Busque por chave, título ou dev — ou use os filtros "Dev"/"QA" ao lado pra ver só o que é seu.',
  },
  {
    target: 'first-card-status',
    title: 'Problema e Solução já vêm do Jira',
    desc: 'O sistema tenta extrair isso sozinho da descrição da issue. Complete a evidência (print/vídeo) e marque o status aqui conforme avança. Quando marcar "Pronta", o card recolhe sozinho — clique nele pra reabrir se precisar reconferir algo.',
  },
  {
    target: 'jira-import',
    title: 'Importação do Jira',
    desc: 'Normalmente o PO ou o Agile já trouxe as issues pra cá. Esse botão importa mais issues, se precisar.',
  },
  {
    target: 'start-teatro',
    title: 'Apresente no Modo Teatro',
    desc: 'Com os cards prontos, clique aqui pra apresentar em tela cheia, sem sair da ferramenta.',
  },
];

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
          className="fixed rounded-2xl ring-2 ring-violet-500 pointer-events-none"
          animate={{
            top: rect.top - PAD, left: rect.left - PAD,
            width: rect.width + PAD * 2, height: rect.height + PAD * 2,
          }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          style={{ boxShadow: '0 0 0 9999px rgba(2, 6, 23, 0.78)' }}
        />
      ) : (
        <div className="fixed inset-0 bg-slate-950/78" />
      )}

      <AnimatePresence mode="wait">
        <motion.div
          key={stepIndex}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.18 }}
          className="fixed bg-white dark:bg-slate-900 rounded-2xl shadow-2xl p-5 space-y-3 border border-slate-200 dark:border-slate-800"
          style={tooltipStyle}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2 text-violet-600 dark:text-violet-400">
              <Sparkles className="h-4 w-4" />
              <span className="text-[9px] font-black uppercase tracking-widest">{stepIndex + 1} / {STEPS.length}</span>
            </div>
            <button onClick={finish} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300" title="Pular tour">
              <X className="h-4 w-4" />
            </button>
          </div>
          <h4 className="text-sm font-black text-slate-900 dark:text-slate-100">{step.title}</h4>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-medium">{step.desc}</p>
          <div className="flex items-center justify-between pt-2">
            <button onClick={finish} className="text-[10px] font-bold uppercase text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
              Pular tour
            </button>
            <div className="flex items-center gap-2">
              {stepIndex > 0 && (
                <Button variant="ghost" size="sm" onClick={prev} className="h-8 px-3 text-[10px] font-black uppercase gap-1.5">
                  <ArrowLeft className="h-3 w-3" /> Voltar
                </Button>
              )}
              <Button size="sm" onClick={next} className="h-8 px-4 bg-violet-600 hover:bg-violet-700 text-white text-[10px] font-black uppercase gap-1.5">
                {stepIndex < STEPS.length - 1 ? <>Próximo <ArrowRight className="h-3 w-3" /></> : 'Concluir'}
              </Button>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

'use client';

import React, { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X, MessageSquareHeart, Send, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';
import { feedbackApi } from '@/app/feedback/api';

interface FeedbackWidgetProps {
  toolName: string;
  autoTriggerSignal?: number; // Passar Date.now() para disparar automaticamente
  showFloatingButton?: boolean;
  externalTriggerSignal?: number;
  triggerVariant?: 'default' | 'icon' | 'none';
}

export function FeedbackWidget({
  toolName,
  autoTriggerSignal,
  showFloatingButton = true,
  externalTriggerSignal,
  triggerVariant = 'default'
}: FeedbackWidgetProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [score, setScore] = useState<number | null>(null);
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { session } = useAuth();

  const handleClose = (val: boolean) => {
    setIsOpen(val);
    if (!val) setTimeout(() => { setStep(1); setScore(null); setComment(''); }, 300);
  };

  useEffect(() => {
    if (externalTriggerSignal) {
      setIsOpen(true);
    }
  }, [externalTriggerSignal]);

  useEffect(() => {
    // Só bloqueia a abertura AUTOMÁTICA. O usuário ainda pode clicar no botão flutuante manualmente.
    if (autoTriggerSignal) {
      const lastSent = localStorage.getItem(`feedback_sent_${toolName}`);
      if (!lastSent || Date.now() - Number(lastSent) >= 30 * 24 * 60 * 60 * 1000) {
        setIsOpen(true);
      }
    }
  }, [autoTriggerSignal, toolName]);

  const handleScore = (val: number) => {
    setScore(val);
    setStep(2);
  };

  const handleSubmit = async () => {
    if (score === null && !comment.trim()) return;
    setIsSubmitting(true);
    try {
      await feedbackApi.saveFeedback({
        toolName: toolName,
        score: score ?? -1, // -1 representa uma sugestão sem nota atribuída
        comment: comment.trim(),
        userId: session?.id || 'anonymous',
      });
      localStorage.setItem(`feedback_sent_${toolName}`, Date.now().toString());
      setStep(3);
      setTimeout(() => handleClose(false), 2500);
    } catch (e) {
      console.error("Erro ao salvar feedback", e);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getScoreColor = (val: number) => {
    if (val <= 6) return 'hover:bg-red-500 hover:text-white border-red-200 text-red-600';
    if (val <= 8) return 'hover:bg-yellow-500 hover:text-white border-yellow-200 text-yellow-600';
    return 'hover:bg-emerald-500 hover:text-white border-emerald-200 text-emerald-600';
  };

  return (
    <>
      {showFloatingButton && !isOpen && triggerVariant !== 'none' && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="fixed bottom-6 right-6 z-50"
        >
          {triggerVariant === 'icon' ? (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    onClick={() => setIsOpen(true)}
                    size="icon"
                    className="rounded-full h-12 w-12 shadow-xl bg-card text-foreground hover:bg-muted border-2 border-primary/20 transition-all hover:scale-110 hover:border-primary/50"
                  >
                    <MessageSquareHeart className="h-5 w-5 text-primary" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="left" className="bg-slate-900 text-white border-none text-[10px] font-bold uppercase tracking-widest py-2 px-3 rounded-lg shadow-xl">
                  Sugerir Melhoria
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ) : (
            <Button
              onClick={() => setIsOpen(true)}
              className="rounded-2xl h-12 px-5 py-4 shadow-xl bg-card text-foreground hover:bg-muted font-bold tracking-widest uppercase text-[10px] gap-2 border-2 border-primary/20 transition-all hover:scale-105 hover:border-primary/50"
            >
              <MessageSquareHeart className="h-4 w-4 text-primary" /> Sugerir Melhoria
            </Button>
          )}
        </motion.div>
      )}

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            className="fixed bottom-6 right-6 z-[60] w-full max-w-[340px] bg-card border-none shadow-2xl rounded-3xl overflow-hidden ring-1 ring-border/50"
          >
            <div className="bg-primary/5 p-4 flex justify-between items-center border-b border-primary/10">
              <div>
                <h4 className="font-black uppercase tracking-tight text-sm text-foreground">Feedback</h4>
                <p className="text-[10px] text-primary uppercase tracking-widest font-bold">{toolName}</p>
              </div>
              <Button variant="ghost" size="icon" className="h-6 w-6 rounded-full hover:bg-foreground/5" onClick={() => handleClose(false)}>
                <X className="h-3 w-3" />
              </Button>
            </div>

            <div className="p-5">
              <AnimatePresence mode="wait">
                {step === 1 && (
                  <motion.div
                    key="step1"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.2 }}
                    className="space-y-4"
                  >
                    <p className="text-xs font-medium text-center text-muted-foreground leading-relaxed">
                      Qual a probabilidade de você recomendar esta ferramenta para um colega?
                    </p>
                    <div className="flex justify-between items-center gap-1 max-w-full">
                      {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(val => (
                        <button
                          key={val}
                          onClick={() => handleScore(val)}
                          className={cn(
                            "flex-1 aspect-square rounded-full flex items-center justify-center text-[10px] sm:text-[11px] font-black transition-all border bg-background shadow-sm hover:scale-110",
                            getScoreColor(val)
                          )}
                        >
                          {val}
                        </button>
                      ))}
                    </div>
                    <div className="flex justify-between text-[8px] uppercase tracking-widest font-black text-muted-foreground/50 px-1 pt-1">
                      <span>0 - Pouco</span>
                      <span>10 - Muito</span>
                    </div>
                    <div className="pt-2 border-t border-border/50">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full text-[10px] font-bold uppercase tracking-widest text-muted-foreground hover:text-primary transition-colors"
                        onClick={() => { setScore(null); setStep(2); }}
                      >
                        Quero apenas deixar uma sugestão
                      </Button>
                    </div>
                  </motion.div>
                )}

                {step === 2 && (
                  <motion.div
                    key="step2"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.2 }}
                    className="space-y-4"
                  >
                    <p className="text-xs font-bold text-center text-foreground flex items-center justify-center gap-2">
                      {score !== null && (
                        <span className={cn(
                          "flex items-center justify-center w-6 h-6 rounded-full text-[10px] font-black shrink-0 text-white",
                          score <= 6 ? 'bg-red-500' : score <= 8 ? 'bg-yellow-500' : 'bg-emerald-500'
                        )}>{score}</span>
                      )}
                      {score !== null && score >= 9 ? 'Incrível! O que você mais gostou?' : 'O que podemos melhorar?'}
                    </p>
                    <Textarea
                      autoFocus
                      placeholder="Deixe seu comentário opcional..."
                      className="text-xs min-h-[90px] resize-none bg-muted/20 border-border/50 focus-visible:ring-primary/20 rounded-xl"
                      value={comment}
                      onChange={e => setComment(e.target.value)}
                    />
                    <div className="flex gap-2 w-full pt-1">
                      <Button variant="ghost" className="flex-1 text-[10px] font-bold uppercase tracking-widest rounded-xl hover:bg-muted/50" onClick={() => setStep(1)}>Voltar</Button>
                      <Button onClick={handleSubmit} disabled={isSubmitting} className="flex-[2] text-[10px] font-black uppercase tracking-widest shadow-lg shadow-primary/20 rounded-xl">
                        {isSubmitting ? 'Enviando...' : 'Enviar'} <Send className="ml-2 w-3 h-3" />
                      </Button>
                    </div>
                  </motion.div>
                )}

                {step === 3 && (
                  <motion.div
                    key="step3"
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="flex flex-col items-center justify-center py-6 space-y-3 text-emerald-500 text-center"
                  >
                    <motion.div
                      initial={{ scale: 0, rotate: -45 }}
                      animate={{ scale: 1, rotate: 0 }}
                      transition={{ type: "spring", damping: 12 }}
                    >
                      <CheckCircle2 className="w-16 h-16 drop-shadow-md" />
                    </motion.div>
                    <p className="text-xs font-black uppercase tracking-widest text-emerald-600 pt-2">Obrigado pelo Feedback!</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

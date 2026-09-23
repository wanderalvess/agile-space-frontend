'use client';

import React, { useState, useEffect } from 'react';
import {
  Activity,
  Trash2,
  Copy,
  Send,
  AlertCircle,
  Plus,
  Calendar,
  History,
  Pencil
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { dailyFlowApi, DailyReportData } from '@/app/daily-flow/api';
import { useToast } from '@/hooks/use-toast';
import { format, parseISO, isToday, isYesterday } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { motion, AnimatePresence } from 'framer-motion';
import { AgileSpinner } from '@/components/ui/AgileSpinner';
import { WorkspaceSectionHeader } from './WorkspaceSectionHeader';

export function DailyHelper({ userProfile }: { userProfile: any }) {
  const { toast } = useToast();

  const effectiveUserId = userProfile?.id || userProfile?.email;

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasBlocker, setHasBlocker] = useState(false);
  const [editingReport, setEditingReport] = useState<DailyReportData | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  const [myReports, setMyReports] = useState<DailyReportData[]>([]);

  const [formData, setFormData] = useState({
    yesterday: '',
    today: '',
    blockers: ''
  });

  // Carrega reports do Spring Boot (sem realtime)
  useEffect(() => {
    if (!effectiveUserId) {
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);

    (async () => {
      try {
        const reports = await dailyFlowApi.listDailyReports(effectiveUserId);
        if (cancelled) return;
        reports.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
        setMyReports(reports);
      } catch (err) {
        console.error('Erro ao carregar dados do Daily Helper:', err);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [effectiveUserId]);

  // Auto-fill logic
  const handleOpenNewReport = () => {
    setEditingReport(null);
    const latestReport = myReports?.[0];
    setFormData({
      yesterday: latestReport?.today || '',
      today: '',
      blockers: ''
    });
    setHasBlocker(false);
    setSelectedDate(new Date());
  };

  const handleEditReport = (report: DailyReportData) => {
    setEditingReport(report);
    setFormData({
      yesterday: report.yesterday,
      today: report.today,
      blockers: report.blockers || ''
    });
    setHasBlocker(!!(report.blockers && report.blockers.trim()));
    setSelectedDate(parseISO(report.date));
  };

  const handleDeleteReport = async (id?: string) => {
    if (!id || !window.confirm('Deseja realmente excluir este report?')) return;
    try {
      await dailyFlowApi.deleteDailyReport(id);
      setMyReports(prev => prev.filter(r => r.id !== id));
      toast({ title: "Excluído!", description: "O report foi removido do seu histórico." });
    } catch (error) {
      toast({ title: "Erro", description: "Não foi possível excluir o report.", variant: "destructive" });
    }
  };

  const handleCopy = (report: DailyReportData) => {
    let text = `*Daily Status - ${userProfile?.name || ''}*\n`;
    text += `[DATA] ${format(parseISO(report.date), "dd/MM/yyyy")}\n\n`;
    text += `[ONTEM] ${report.yesterday}\n`;
    text += `[HOJE] ${report.today}\n`;
    if (report.blockers && report.blockers.trim()) text += `[IMPEDIMENTOS] ${report.blockers}`;

    navigator.clipboard.writeText(text);
    toast({ title: "Copiado!", description: "Status formatado pronto para o Slack/Teams." });
  };

  const handleSaveReport = async () => {
    if (!effectiveUserId || !userProfile) return;
    if (!formData.yesterday.trim() || !formData.today.trim()) {
      toast({ title: "Ops!", description: "Preencha o que fez ontem e fará hoje.", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);
    try {
      const dateStr = format(selectedDate, 'yyyy-MM-dd');

      const saved = await dailyFlowApi.saveOrUpdateDailyReport({
        userId: effectiveUserId,
        yesterday: formData.yesterday.trim(),
        today: formData.today.trim(),
        blockers: hasBlocker ? formData.blockers.trim() : '',
        date: dateStr
      });

      setMyReports(prev => {
        const exists = prev.some(r => r.id === saved.id);
        const next = exists ? prev.map(r => r.id === saved.id ? saved : r) : [saved, ...prev];
        return [...next].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
      });

      toast({
        title: editingReport ? "Atualizado!" : "Enviado!",
        description: "Seu status já está no seu histórico e no Mural do Daily Flow."
      });

      if (editingReport) {
        setEditingReport(null);
        setFormData({ yesterday: '', today: '', blockers: '' });
        setHasBlocker(false);
      }
    } catch (error) {
      toast({ title: "Erro", description: "Não foi possível salvar o report.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col w-full h-full relative overflow-hidden animate-in fade-in duration-700 gap-4">
      <WorkspaceSectionHeader
        kicker="Assíncrono"
        accent="indigo"
        title="Meu"
        titleAccent="Histórico"
        subtitle={`Progresso individual • ${myReports?.length || 0} registros`}
        className="shrink-0"
        action={
          <div className="flex items-end gap-3">
            <Button
              onClick={handleOpenNewReport}
              variant="outline"
              className="h-10 px-4 border-border/80 text-foreground hover:bg-muted/60 rounded-lg font-black uppercase text-[8px] tracking-[0.2em] transition-all gap-2"
            >
              <Plus className="h-3 w-3" /> Novo Status
            </Button>

            <div className="flex flex-col gap-1">
              <span className="text-[8px] font-black uppercase tracking-widest text-muted-foreground ml-1">Referência</span>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  type="date"
                  value={format(selectedDate, 'yyyy-MM-dd')}
                  onChange={(e) => setSelectedDate(parseISO(e.target.value))}
                  className="h-9 pl-9 bg-background rounded-lg border-border text-foreground font-bold w-[150px] text-xs shadow-xs focus-visible:ring-indigo-500/20"
                />
              </div>
            </div>
          </div>
        }
      />

      {/* CONTEÚDO EM GRID COMPACTO */}
      <div className="flex-1 overflow-hidden">
        <div className="h-full grid grid-cols-1 lg:grid-cols-12 gap-5 pb-6">

          {/* LADO ESQUERDO: TIMELINE (MAIOR DENSIDADE) */}
          <div className="lg:col-span-7 xl:col-span-8 overflow-y-auto no-scrollbar pb-10 px-1">
            <div className="relative">
              {myReports && myReports.length > 0 && (
                <div className="absolute left-[17px] top-4 bottom-4 w-[1px] bg-border/60" />
              )}

              {isLoading ? (
                <div className="h-64 flex flex-col items-center justify-center gap-4 text-muted-foreground">
                  <AgileSpinner size="md" variant="indigo" />
                  <p className="text-[9px] font-black uppercase tracking-[0.3em] animate-pulse">Sincronizando...</p>
                </div>
              ) : myReports && myReports.length > 0 ? (
                <div className="space-y-3">
                  <AnimatePresence mode="popLayout">
                    {myReports.map((report, index) => {
                      const reportHasBlocker = !!(report.blockers && report.blockers.trim());
                      return (
                      <motion.div
                        key={report.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.02 }}
                        className="relative pl-10"
                      >
                        <div className={cn(
                          "absolute left-3 top-5 w-2.5 h-2.5 rounded-full border-2 border-background shadow-xs z-10",
                          reportHasBlocker ? "bg-rose-500 ring-2 ring-rose-500/20" : "bg-indigo-600 ring-2 ring-indigo-500/20"
                        )} />

                        <div className={cn(
                          "group p-4 rounded-2xl border shadow-xs hover:shadow-md transition-all duration-200",
                          reportHasBlocker
                            ? "border-rose-500/30 bg-rose-500/5 text-card-foreground"
                            : "border-border/80 bg-card text-card-foreground hover:border-indigo-500/40"
                        )}>
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-black text-foreground italic tracking-tight">
                                {format(parseISO(report.date), "dd 'de' MMM", { locale: ptBR })}
                              </span>
                              <Badge variant="outline" className="text-[7px] font-black uppercase tracking-widest border-border/60 bg-muted/60 text-muted-foreground py-0 px-1.5 h-3.5">
                                {isToday(parseISO(report.date)) ? 'Hoje' : isYesterday(parseISO(report.date)) ? 'Ontem' : format(parseISO(report.date), "EEEE", { locale: ptBR })}
                              </Badge>
                            </div>

                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                              <Button variant="ghost" size="icon" onClick={() => handleCopy(report)} className="h-6 w-6 rounded-md text-muted-foreground hover:text-indigo-600 hover:bg-indigo-500/10"><Copy className="h-3 w-3" /></Button>
                              <Button variant="ghost" size="icon" onClick={() => handleEditReport(report)} className="h-6 w-6 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted"><Pencil className="h-3 w-3" /></Button>
                              <Button variant="ghost" size="icon" onClick={() => handleDeleteReport(report.id)} className="h-6 w-6 rounded-md text-muted-foreground hover:text-rose-600 hover:bg-rose-500/10"><Trash2 className="h-3 w-3" /></Button>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 xl:grid-cols-2 gap-x-6 gap-y-3">
                            <div className="space-y-1">
                              <div className="flex items-center gap-1 opacity-60">
                                <History className="h-2.5 w-2.5 text-indigo-500" />
                                <span className="text-[7px] font-black uppercase tracking-widest text-muted-foreground">Ontem</span>
                              </div>
                              <p className="text-[10px] font-medium text-muted-foreground leading-relaxed pl-3 border-l border-border/70 break-words whitespace-pre-wrap">
                                {report.yesterday}
                              </p>
                            </div>

                             <div className="space-y-1">
                              <div className="flex items-center gap-1">
                                <Activity className="h-2.5 w-2.5 text-indigo-500" />
                                <span className="text-[7px] font-black uppercase tracking-widest text-indigo-500">Hoje</span>
                              </div>
                              <p className="text-[10px] font-bold text-foreground leading-relaxed pl-3 border-l border-indigo-500/50 break-words whitespace-pre-wrap">
                                {report.today}
                              </p>
                            </div>
                          </div>

                          {reportHasBlocker && (
                            <div className="mt-3 pt-2 border-t border-rose-500/20">
                                <p className="text-[10px] font-bold text-rose-600 dark:text-rose-400 bg-rose-500/10 px-2.5 py-1.5 rounded-lg border border-rose-500/20 flex items-center gap-2 break-words whitespace-pre-wrap">
                                  <AlertCircle className="h-3 w-3 shrink-0" />
                                  <span className="flex-1">{report.blockers}</span>
                                </p>
                            </div>
                          )}
                        </div>
                      </motion.div>
                      );
                    })}
                  </AnimatePresence>
                </div>
              ) : (
                <div className="h-64 flex flex-col items-center justify-center text-center py-10 bg-muted/20 rounded-3xl border-2 border-dashed border-border/60">
                  <Calendar className="h-6 w-6 text-muted-foreground/40 mb-3" />
                  <p className="text-muted-foreground font-bold uppercase tracking-widest text-[8px]">Nenhum registro encontrado</p>
                </div>
              )}
            </div>
          </div>

          {/* LADO DIREITO: FORMULÁRIO SLIM (COM SCROLL PRÓPRIO SE NECESSÁRIO) */}
          <div className="lg:col-span-5 xl:col-span-4 overflow-y-auto no-scrollbar pb-10">
            <div className="sticky top-0">
              <Card id="status-form" className="rounded-2xl border border-border/80 shadow-xl shadow-indigo-500/5 bg-card text-card-foreground overflow-hidden p-4 animate-in fade-in slide-in-from-right-2 duration-300">
                <div className="space-y-4">
                  <div className="space-y-0.5">
                    <h3 className="text-base font-black italic tracking-tighter text-foreground uppercase">
                      {editingReport ? 'Editar' : 'Novo'} <span className="text-indigo-500">Status</span>
                    </h3>
                    <p className="text-[7px] font-black uppercase tracking-widest text-muted-foreground">Sincronização diária individual</p>
                  </div>

                  <div className="space-y-3">
                     <div className="space-y-1">
                       <label className="text-[7px] font-black uppercase tracking-widest text-muted-foreground italic ml-1 flex items-center gap-1.5">
                         <span className="w-1 h-1 rounded-full bg-muted-foreground/50" />
                         O que você fez ontem?
                       </label>

                       <Textarea
                         value={formData.yesterday}
                         onChange={e => setFormData({...formData, yesterday: e.target.value})}
                         placeholder="Resumo das entregas..."
                         className="bg-background border-border/80 text-foreground rounded-xl min-h-[80px] text-[10px] font-medium focus-visible:ring-indigo-500/20 resize-none p-2.5 placeholder:text-muted-foreground/50"
                       />
                     </div>

                    <div className="space-y-1">
                      <label className="text-[7px] font-black uppercase tracking-widest text-indigo-500 italic ml-1 flex items-center gap-1.5">
                        <span className="w-1 h-1 rounded-full bg-indigo-500" />
                        Foco para hoje?
                      </label>
                      <Textarea
                        value={formData.today}
                        onChange={e => setFormData({...formData, today: e.target.value})}
                        placeholder="Principais objetivos..."
                        className="bg-background border-indigo-500/30 text-foreground rounded-xl min-h-[80px] text-[10px] font-medium focus-visible:ring-indigo-500/20 resize-none p-2.5 placeholder:text-muted-foreground/50"
                      />
                    </div>

                    <div className="pt-0.5">
                      <button
                        onClick={() => setHasBlocker(!hasBlocker)}
                        type="button"
                        className={cn(
                          "w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg border text-[7px] font-black uppercase tracking-widest transition-all",
                          hasBlocker ? "bg-rose-500/10 border-rose-500/30 text-rose-500" : "bg-card border-border/80 text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                        )}
                      >
                        Bloqueios?
                        <div className={cn("w-1.5 h-1.5 rounded-full", hasBlocker ? "bg-rose-500 animate-pulse" : "bg-muted-foreground/30")} />
                      </button>
                    </div>

                    <AnimatePresence>
                      {hasBlocker && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="space-y-2"
                        >
                          <Textarea
                            value={formData.blockers}
                            onChange={e => setFormData({...formData, blockers: e.target.value})}
                            placeholder="Descreva o que está travando..."
                            className="bg-rose-500/10 border-rose-500/30 text-rose-600 dark:text-rose-400 rounded-xl min-h-[40px] text-[10px] font-medium focus-visible:ring-rose-500/20 resize-none p-2.5 placeholder:text-rose-400/50"
                          />
                        </motion.div>
                      )}
                    </AnimatePresence>

                    <Button
                      onClick={handleSaveReport}
                      disabled={isSubmitting}
                      className={cn(
                        "w-full h-10 text-white rounded-lg font-black uppercase text-[8px] tracking-[0.2em] shadow-lg transition-all gap-2 mt-1",
                        editingReport
                          ? "bg-slate-900 dark:bg-slate-100 dark:text-slate-950 shadow-slate-900/20 hover:bg-slate-800"
                          : "bg-indigo-600 shadow-indigo-500/20 hover:bg-indigo-500"
                      )}
                    >
                      {isSubmitting ? <AgileSpinner size="xs" variant="white" /> : (
                        <>
                          {editingReport ? <Pencil className="h-3 w-3" /> : <Send className="h-3 w-3" />}
                          {editingReport ? 'Salvar Alterações' : 'Enviar Status'}
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

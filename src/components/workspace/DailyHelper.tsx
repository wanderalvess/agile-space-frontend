'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Activity,
  Trash2,
  Copy,
  Send,
  AlertCircle,
  Clock,
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
import { workspaceApi } from '@/app/workspace/api';
import { focusApi, FocusSessionData } from '@/app/focus/api';
import { KanbanCardData } from '@/components/workspace/types';
import { useToast } from '@/hooks/use-toast';
import { format, parseISO, isToday, isYesterday } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { motion, AnimatePresence } from 'framer-motion';
import { AgileSpinner } from '@/components/ui/AgileSpinner';

export function DailyHelper({ userProfile }: { userProfile: any }) {
  const { toast } = useToast();

  const effectiveUserId = userProfile?.id || userProfile?.email;

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasBlocker, setHasBlocker] = useState(false);
  const [editingReport, setEditingReport] = useState<DailyReportData | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  const [myReports, setMyReports] = useState<DailyReportData[]>([]);
  const [focusSessions, setFocusSessions] = useState<FocusSessionData[]>([]);
  const [kanbanCards, setKanbanCards] = useState<KanbanCardData[]>([]);

  const [formData, setFormData] = useState({
    yesterday: '',
    today: '',
    blockers: ''
  });

  // Carrega reports, sessões de foco e cards do kanban do Spring Boot (sem realtime)
  useEffect(() => {
    if (!effectiveUserId) {
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);

    (async () => {
      try {
        const [reports, sessions, cards] = await Promise.all([
          dailyFlowApi.listDailyReports(effectiveUserId),
          focusApi.getSessions(effectiveUserId).catch(() => []),
          workspaceApi.getKanbanCards(effectiveUserId).catch(() => [])
        ]);
        if (cancelled) return;
        reports.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
        setMyReports(reports);
        setFocusSessions(sessions);
        setKanbanCards(cards);
      } catch (err) {
        console.error('Erro ao carregar dados do Daily Helper:', err);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [effectiveUserId]);

  const yesterdaySessions = useMemo(() => {
    if (!focusSessions || focusSessions.length === 0) return [];
    const yesterdayDate = new Date(selectedDate);
    yesterdayDate.setDate(yesterdayDate.getDate() - 1);
    const yestStr = format(yesterdayDate, 'yyyy-MM-dd');
    return focusSessions.filter((s) => {
      if (!s.createdAt) return false;
      const date = new Date(s.createdAt);
      return !isNaN(date.getTime()) && format(date, 'yyyy-MM-dd') === yestStr;
    });
  }, [focusSessions, selectedDate]);

  const yesterdayTotalMinutes = useMemo(() => {
    return yesterdaySessions.reduce((acc: number, s) => acc + (s.durationMinutes || 0), 0);
  }, [yesterdaySessions]);

  const getTaskName = (taskId?: string) => {
    if (!taskId) return undefined;
    const card = kanbanCards.find((c) => c.id === taskId);
    return card ? card.title : undefined;
  };

  const handleImportYesterdayFocus = () => {
    if (yesterdaySessions.length === 0) return;
    let importText = `[SESSÃO DE FOCO]\n`;
    yesterdaySessions.forEach((s) => {
      const taskName = getTaskName((s as any).taskId) || s.taskCategory || 'Sessão de Foco';
      importText += `- TAREFA: ${taskName} (${s.durationMinutes} min)\n`;
    });
    setFormData(prev => ({
      ...prev,
      yesterday: prev.yesterday ? `${prev.yesterday}\n\n${importText.trim()}` : importText.trim()
    }));
    toast({
      title: "Dados Importados",
      description: "As sessões de foco de ontem foram adicionadas ao seu relatório de forma técnica."
    });
  };



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
    <div className="flex-1 flex flex-col w-full h-full bg-[#fcfcfc] relative overflow-hidden animate-in fade-in duration-700">

      {/* HEADER TÁTICO ULTRA-COMPACTO */}
      <div className="px-6 pt-4 pb-3 flex flex-col md:flex-row md:items-end justify-between gap-4 shrink-0 bg-white/60 backdrop-blur-md border-b border-slate-100">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="bg-indigo-50 text-indigo-600 border-indigo-100 font-black uppercase tracking-[0.2em] text-[7px] px-1.5 py-0 italic">Assíncrono</Badge>
          </div>
          <h1 className="text-2xl font-black italic tracking-tighter text-slate-900 uppercase flex items-center gap-3">
            Meu <span className="text-indigo-600 not-italic">Histórico</span>
          </h1>
          <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-slate-400">Progresso Individual • {myReports?.length || 0} Registros</p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex flex-col gap-1">
            <span className="text-[8px] font-black uppercase tracking-widest text-transparent select-none ml-1">Espaçador</span>
            <Button
              onClick={handleOpenNewReport}
              variant="outline"
              className="h-9 px-4 border-slate-200 text-slate-600 rounded-lg font-black uppercase text-[8px] tracking-[0.2em] hover:bg-slate-50 transition-all gap-2"
            >
              <Plus className="h-3 w-3" /> Novo Status
            </Button>
          </div>

          <div className="flex flex-col gap-1">
            <span className="text-[8px] font-black uppercase tracking-widest text-slate-400 ml-1">Referência</span>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <Input
                type="date"
                value={format(selectedDate, 'yyyy-MM-dd')}
                onChange={(e) => setSelectedDate(parseISO(e.target.value))}
                className="h-9 pl-9 bg-white rounded-lg border-slate-200 font-bold text-slate-700 w-[150px] text-xs shadow-sm focus-visible:ring-indigo-500/20"
              />
            </div>
          </div>
        </div>
      </div>

      {/* CONTEÚDO EM GRID COMPACTO */}
      <div className="flex-1 overflow-hidden">
        <div className="h-full grid grid-cols-1 lg:grid-cols-12 gap-5 p-6 pt-3">

          {/* LADO ESQUERDO: TIMELINE (MAIOR DENSIDADE) */}
          <div className="lg:col-span-7 xl:col-span-8 overflow-y-auto no-scrollbar pb-10 px-1">
            <div className="relative">
              {myReports && myReports.length > 0 && (
                <div className="absolute left-[17px] top-4 bottom-4 w-[1px] bg-slate-200/50" />
              )}

              {isLoading ? (
                <div className="h-64 flex flex-col items-center justify-center gap-4 text-slate-400">
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
                          "absolute left-3 top-5 w-2.5 h-2.5 rounded-full border-2 border-white shadow-sm z-10",
                          reportHasBlocker ? "bg-rose-500" : "bg-indigo-600"
                        )} />

                        <div className={cn(
                          "group p-4 rounded-2xl border bg-white shadow-sm hover:shadow-md transition-all duration-200",
                          reportHasBlocker ? "border-rose-100 bg-rose-50/5" : "border-slate-100 bg-white/80"
                        )}>
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-black text-slate-900 italic tracking-tight">
                                {format(parseISO(report.date), "dd 'de' MMM", { locale: ptBR })}
                              </span>
                              <Badge variant="outline" className="text-[7px] font-black uppercase tracking-widest border-none bg-slate-50 text-slate-400 py-0 px-1 h-3.5">
                                {isToday(parseISO(report.date)) ? 'Hoje' : isYesterday(parseISO(report.date)) ? 'Ontem' : format(parseISO(report.date), "EEEE", { locale: ptBR })}
                              </Badge>
                            </div>

                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                              <Button variant="ghost" size="icon" onClick={() => handleCopy(report)} className="h-6 w-6 rounded-md text-slate-400 hover:text-indigo-600 hover:bg-indigo-50"><Copy className="h-3 w-3" /></Button>
                              <Button variant="ghost" size="icon" onClick={() => handleEditReport(report)} className="h-6 w-6 rounded-md text-slate-400 hover:text-slate-900 hover:bg-slate-100"><Pencil className="h-3 w-3" /></Button>
                              <Button variant="ghost" size="icon" onClick={() => handleDeleteReport(report.id)} className="h-6 w-6 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50"><Trash2 className="h-3 w-3" /></Button>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 xl:grid-cols-2 gap-x-6 gap-y-3">
                            <div className="space-y-1">
                              <div className="flex items-center gap-1 opacity-40">
                                <History className="h-2 w-2 text-indigo-500" />
                                <span className="text-[7px] font-black uppercase tracking-widest">Ontem</span>
                              </div>
                              <p className="text-[10px] font-medium text-slate-500 leading-relaxed pl-3 border-l border-slate-100 break-words whitespace-pre-wrap">
                                {report.yesterday}
                              </p>
                            </div>

                             <div className="space-y-1">
                              <div className="flex items-center gap-1">
                                <Activity className="h-2.5 w-2.5 text-indigo-600" />
                                <span className="text-[7px] font-black uppercase tracking-widest text-indigo-600 font-black">Hoje</span>
                              </div>
                              <p className="text-[10px] font-bold text-slate-700 leading-relaxed pl-3 border-l border-indigo-200 break-words whitespace-pre-wrap">
                                {report.today}
                              </p>
                            </div>
                          </div>

                          {reportHasBlocker && (
                            <div className="mt-3 pt-2 border-t border-rose-100/50">
                                <p className="text-[10px] font-bold text-rose-600 bg-rose-50/50 px-2 py-1 rounded-lg border border-rose-100/20 flex items-center gap-2 break-words whitespace-pre-wrap">
                                  <AlertCircle className="h-2.5 w-2.5 shrink-0" />
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
                <div className="h-64 flex flex-col items-center justify-center text-center py-10 bg-slate-50/30 rounded-3xl border-2 border-dashed border-slate-100">
                  <Calendar className="h-6 w-6 text-slate-200 mb-3" />
                  <p className="text-slate-400 font-bold uppercase tracking-widest text-[8px]">Nenhum registro encontrado</p>
                </div>
              )}
            </div>
          </div>

          {/* LADO DIREITO: FORMULÁRIO SLIM (COM SCROLL PRÓPRIO SE NECESSÁRIO) */}
          <div className="lg:col-span-5 xl:col-span-4 overflow-y-auto no-scrollbar pb-10">
            <div className="sticky top-0">
              <Card id="status-form" className="rounded-2xl border border-slate-100 shadow-xl shadow-indigo-500/5 bg-white overflow-hidden p-4 animate-in fade-in slide-in-from-right-2 duration-300">
                <div className="space-y-4">
                  <div className="space-y-0.5">
                    <h3 className="text-base font-black italic tracking-tighter text-slate-900 uppercase">
                      {editingReport ? 'Editar' : 'Novo'} <span className="text-indigo-600">Status</span>
                    </h3>
                    <p className="text-[7px] font-black uppercase tracking-widest text-slate-400">Sincronização diária individual</p>
                  </div>

                  <div className="space-y-3">
                     <div className="space-y-1">
                       <label className="text-[7px] font-black uppercase tracking-widest text-slate-500 italic ml-1 flex items-center gap-1.5">
                         <span className="w-1 h-1 rounded-full bg-slate-300" />
                         O que você fez ontem?
                       </label>

                       {/* Banner de sugestão de importação técnico */}
                       {yesterdayTotalMinutes > 0 && (
                         <div className="mb-2 flex items-center justify-between gap-2 text-[10px] font-medium text-slate-600 border border-slate-200 bg-slate-50 p-2 rounded-xl">
                           <div className="flex items-center gap-1.5 min-w-0">
                             <Clock className="h-3.5 w-3.5 text-indigo-500 shrink-0" />
                             <span className="truncate">Detectamos {yesterdayTotalMinutes} minutos de foco registrados ontem.</span>
                           </div>
                           <Button
                             variant="outline"
                             size="sm"
                             onClick={handleImportYesterdayFocus}
                             className="h-6 px-2 text-[8px] font-black uppercase tracking-wider rounded-md border-indigo-200 text-indigo-600 bg-indigo-50/50 hover:bg-indigo-50 hover:text-indigo-700 transition-all shrink-0"
                           >
                             Importar Dados
                           </Button>
                         </div>
                       )}

                       <Textarea
                         value={formData.yesterday}
                         onChange={e => setFormData({...formData, yesterday: e.target.value})}
                         placeholder="Resumo das entregas..."
                         className="bg-slate-50/50 border-slate-100 rounded-xl min-h-[80px] text-[10px] font-bold text-slate-700 focus-visible:ring-indigo-500/10 resize-none p-2.5"
                       />
                     </div>

                    <div className="space-y-1">
                      <label className="text-[7px] font-black uppercase tracking-widest text-indigo-500 italic ml-1 flex items-center gap-1.5">
                        <span className="w-1 h-1 rounded-full bg-indigo-400" />
                        Foco para hoje?
                      </label>
                      <Textarea
                        value={formData.today}
                        onChange={e => setFormData({...formData, today: e.target.value})}
                        placeholder="Principais objetivos..."
                        className="bg-indigo-50/20 border-indigo-100/50 rounded-xl min-h-[80px] text-[10px] font-bold text-slate-800 focus-visible:ring-indigo-500/10 resize-none p-2.5"
                      />
                    </div>

                    <div className="pt-0.5">
                      <button
                        onClick={() => setHasBlocker(!hasBlocker)}
                        className={cn(
                          "w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg border text-[7px] font-black uppercase tracking-widest transition-all",
                          hasBlocker ? "bg-rose-50 border-rose-200 text-rose-600" : "bg-white border-slate-100 text-slate-400 hover:bg-slate-50"
                        )}
                      >
                        Bloqueios?
                        <div className={cn("w-1 h-1 rounded-full", hasBlocker ? "bg-rose-500 animate-pulse" : "bg-slate-200")} />
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
                            className="bg-rose-50/30 border-rose-100 rounded-xl min-h-[40px] text-[10px] font-bold text-rose-700 focus-visible:ring-rose-500/10 resize-none p-2.5"
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
                          ? "bg-slate-900 shadow-slate-900/20 hover:bg-slate-800"
                          : "bg-indigo-600 shadow-indigo-500/20 hover:bg-indigo-700"
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

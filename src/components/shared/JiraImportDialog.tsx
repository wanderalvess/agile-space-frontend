'use client';

import React, { useState, useEffect } from 'react';
import {
  CloudDownload, ShieldCheck, Lightbulb, Loader2, Send, AlertTriangle, RotateCcw,
  Search, CheckCircle2, FileUp, Info, X, ChevronDown, Tag, ExternalLink
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { parseJiraXml, fetchJiraIssues, enrichWithCodificacaoChildren, JiraIssue } from '@/services/jiraService';
import { useJiraSettings } from '@/hooks/useJiraSettings';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';

interface JiraImportDialogProps {
  open: boolean;
  onClose: () => void;
  onImport: (issues: JiraIssue[]) => void;
  title?: string;
  description?: string;
}

export function JiraImportDialog({
  open,
  onClose,
  onImport,
  title = "Importar do Jira",
  description = "Conecte sua squad ao Jira via XML ou API para sincronizar tarefas."
}: JiraImportDialogProps) {
  const JQL_PRESETS = [
    { label: '🙋 Minhas Issues', jql: 'assignee = currentUser() AND status != Done' },
    { label: '🏃 Sprint Atual', jql: 'sprint in openSprints()' },
    { label: '📋 Backlog', jql: 'status = "To Do" ORDER BY rank DESC' },
    { label: '📺 Review', jql: 'sprint = NumeroDaSprint AND status = Concluído AND (issuetype in (Legislação, História, Story, Participativo, Spike) OR (issuetype = Manutenção AND priority = Crítica))' },
    { label: '🔍 Refinamento DDWMISSI', jql: 'project = "DDWMISSI" and issuetype != Gestão and issueFunction in linkedIssuesOf("issuetype = Gestão AND summary ~ Refinamento and resolution = unresolved and project= \'DDWMISSI\'")' },
    { label: '✅ Concluídas na Semana', jql: 'assignee = currentUser() AND resolutiondate >= -1w AND status = Done' },
    { label: '⚠️ Bloqueadas', jql: 'assignee = currentUser() AND status = Blocked' },
  ];

  const { toast } = useToast();
  const [tab, setTab] = useState<'xml' | 'api'>('xml');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<JiraIssue[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  // Filtros sobre o resultado retornado (revisar antes de importar).
  const [filterText, setFilterText] = useState('');
  const [typeFilter, setTypeFilter] = useState<Set<string>>(new Set());
  const [statusFilter, setStatusFilter] = useState<Set<string>>(new Set());
  // Quais issues estão com o detalhe (descrição completa/critérios) expandido.
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  // API State
  const [domain, setDomain] = useState('');
  const [token, setToken] = useState('');
  const [jql, setJql] = useState('');
  const [saveDefault, setSaveDefault] = useState(false);

  const { settings, saveSettings } = useJiraSettings();

  // Auto-populate saved credentials
  useEffect(() => {
    if (settings && open && tab === 'api' && !domain && !token) {
      console.log('[Jira Dialog] Auto-populating settings:', settings.domain);
      setDomain(settings.domain || '');
      setToken(settings.token || '');
      setSaveDefault(true);
    }
  }, [settings, open, tab]);

  const handleXml = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;

    setLoading(true);
    try {
      const allIssues: JiraIssue[] = [];
      const filePromises = Array.from(files).map(async (file) => {
        const text = await file.text();
        return parseJiraXml(text);
      });

      const resultsArray = await Promise.all(filePromises);
      resultsArray.forEach(issues => allIssues.push(...issues));

      // Deduplicate by key
      const uniqueIssues = Array.from(new Map(allIssues.map(i => [i.key, i])).values());

      setResults(uniqueIssues);
      clearFilters();
      setSelected(new Set(uniqueIssues.map(i => i.key))); // Select all by default
      toast({ title: "Arquivo lido!", description: `${uniqueIssues.length} issues detectadas.` });
    } catch (err: any) {
      toast({ title: "Erro no XML", description: err.message || "Arquivo inválido.", variant: "destructive" });
    } finally {
      setLoading(false);
      e.target.value = '';
    }
  };

  const handleApiSearch = async () => {
    if (!domain || !token || !jql) return;
    setLoading(true);
    try {
      if (saveDefault) {
        await saveSettings({ domain, token });
      }
      const { issues, total } = await fetchJiraIssues(domain, token, jql);
      // Problema/solução às vezes só existem na subtarefa "Codificação"
      // (issue filha), não na história em si — busca extra só pra quem
      // ainda ficou sem os dois campos.
      const enriched = await enrichWithCodificacaoChildren(domain, token, issues);
      setResults(enriched);
      clearFilters();
      setSelected(new Set(enriched.map(i => i.key))); // Select all by default
      // Avisa quando o board é maior que o limite retornado (antes truncava
      // silenciosamente): refine a JQL para ver o resto.
      const truncated = typeof total === 'number' && total > issues.length;
      toast({
        title: "Busca concluída!",
        description: truncated
          ? `${issues.length} de ${total} issues (limite atingido — refine a JQL para ver o resto).`
          : `${issues.length} issues encontradas.`,
        variant: truncated ? "default" : undefined,
      });
    } catch (err: any) {
      toast({ title: "Erro na busca", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const toggleSelect = (key: string) => {
    const next = new Set(selected);
    if (next.has(key)) next.delete(key); else next.add(key);
    setSelected(next);
  };

  const toggleTypeFilter = (t: string) => {
    setTypeFilter(prev => { const n = new Set(prev); n.has(t) ? n.delete(t) : n.add(t); return n; });
  };
  const toggleStatusFilter = (s: string) => {
    setStatusFilter(prev => { const n = new Set(prev); n.has(s) ? n.delete(s) : n.add(s); return n; });
  };

  const norm = (s?: string) => (s || '').toLowerCase();
  const stripHtml = (s?: string) => (s || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

  const distinctTypes = Array.from(new Set(results.map(r => r.type).filter(Boolean)));
  const distinctStatuses = Array.from(new Set(results.map(r => r.status).filter(Boolean)));

  // Resultado filtrado (busca por texto + tipo + status). Filtro vazio = tudo.
  const filteredResults = results.filter(r => {
    if (typeFilter.size && !typeFilter.has(r.type)) return false;
    if (statusFilter.size && !statusFilter.has(r.status)) return false;
    if (filterText.trim()) {
      const q = norm(filterText);
      if (!norm(r.key).includes(q) && !norm(r.title).includes(q) && !norm(r.description).includes(q)) return false;
    }
    return true;
  });

  const allFilteredSelected = filteredResults.length > 0 && filteredResults.every(r => selected.has(r.key));

  // Marcar/desmarcar age sobre o que está VISÍVEL (filtrado), preservando o
  // resto da seleção.
  const toggleAll = () => {
    const next = new Set(selected);
    if (allFilteredSelected) filteredResults.forEach(r => next.delete(r.key));
    else filteredResults.forEach(r => next.add(r.key));
    setSelected(next);
  };

  // Cor do badge de status por heurística de texto (Jira varia o nome).
  const statusClasses = (s?: string) => {
    const t = norm(s);
    if (/(done|conclu|fech|resolv|encerr)/.test(t)) return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400';
    if (/(progress|andamento|doing|desenvolv|execu)/.test(t)) return 'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400';
    if (/(block|imped|bloque)/.test(t)) return 'bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400';
    if (/(review|revis|test|qa|homolog)/.test(t)) return 'bg-violet-100 text-violet-700 dark:bg-violet-950/40 dark:text-violet-400';
    return 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300';
  };

  const clearFilters = () => {
    setFilterText('');
    setTypeFilter(new Set());
    setStatusFilter(new Set());
  };

  const reset = () => {
    setResults([]);
    setSelected(new Set());
    clearFilters();
    setExpanded(new Set());
    setJql('');
    if (!saveDefault) {
      setDomain('');
      setToken('');
    }
  };

  const toggleExpand = (key: string) => {
    const next = new Set(expanded);
    if (next.has(key)) next.delete(key); else next.add(key);
    setExpanded(next);
  };

  const handleConfirmImport = () => {
    const selectedIssues = results.filter(r => selected.has(r.key));
    onImport(selectedIssues);
    reset();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { reset(); onClose(); } }}>
      <DialogContent className="max-w-4xl w-[98vw] max-h-[92vh] rounded-[2rem] p-0 border-none shadow-3xl overflow-hidden bg-white dark:bg-slate-900 flex flex-col">
        <DialogHeader className="p-5 pb-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/20 relative overflow-hidden shrink-0">
          <div className="absolute top-0 right-0 p-6 opacity-5 rotate-12">
            <CloudDownload className="h-16 w-16" />
          </div>
          <div className="relative z-10 flex items-center gap-3">
            <div className="w-9 h-9 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-600/20 shrink-0">
              <CloudDownload className="h-4.5 w-4.5 text-white" />
            </div>
            <div>
              <DialogTitle className="text-lg font-black uppercase tracking-tight text-slate-900 dark:text-slate-100 leading-none">
                {title}
              </DialogTitle>
              <DialogDescription className="text-[10px] text-slate-500 dark:text-slate-400 font-medium mt-1 leading-relaxed max-w-sm">
                {description}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col">
          <Tabs value={tab} onValueChange={(v: any) => setTab(v)} className="flex-1 flex flex-col min-h-0">
            <div className="px-6 pt-4 shrink-0">
              <TabsList className="w-full bg-slate-100/80 dark:bg-slate-950 rounded-xl p-1 border border-slate-200/50 dark:border-slate-800">
                <TabsTrigger value="xml" className="flex-1 rounded-lg text-[9px] font-black uppercase tracking-widest py-2 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-900 data-[state=active]:shadow-sm dark:data-[state=active]:text-indigo-400 transition-all">Upload XML</TabsTrigger>
                <TabsTrigger value="api" className="flex-1 rounded-lg text-[9px] font-black uppercase tracking-widest py-2 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-900 data-[state=active]:shadow-sm dark:data-[state=active]:text-indigo-400 transition-all">Conexão API</TabsTrigger>
              </TabsList>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-4 min-h-0">
              <AnimatePresence mode="wait">
                <motion.div
                  key={tab}
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -5 }}
                  transition={{ duration: 0.15 }}
                  className="space-y-4"
                >
                  <TabsContent value="xml" className="mt-0 outline-none space-y-4">
                    {results.length === 0 ? (
                      <div className="relative group border-2 border-dashed border-slate-200 dark:border-slate-800 hover:border-indigo-500 rounded-2xl bg-slate-50/30 dark:bg-slate-950/20 hover:bg-indigo-50/10 transition-all p-6 flex flex-col items-center justify-center text-center cursor-pointer min-h-[140px]">
                        <FileUp className="h-8 w-8 text-slate-400 group-hover:text-indigo-600 transition-colors mb-2.5" />
                        <span className="text-[10px] font-black uppercase text-slate-700 dark:text-slate-200 tracking-wider">
                           Arraste ou selecione seu arquivo XML do Jira
                        </span>
                        <span className="text-[9px] text-slate-400 dark:text-slate-400 font-bold mt-1.5 max-w-sm leading-relaxed">
                           Dica: No Jira, acesse <span className="text-slate-600 dark:text-slate-400 font-extrabold">Filters &gt; View all issues</span>, aplique a busca e clique em <span className="text-slate-600 dark:text-slate-400 font-extrabold">Export &gt; XML</span>.
                        </span>
                        <input 
                          type="file" 
                          accept=".xml" 
                          multiple 
                          className="absolute inset-0 opacity-0 cursor-pointer" 
                          onChange={handleXml} 
                          disabled={loading} 
                        />
                        {loading && (
                          <div className="absolute inset-0 bg-white/75 dark:bg-slate-900/75 backdrop-blur-xs flex items-center justify-center rounded-2xl">
                            <Loader2 className="h-5 w-5 text-indigo-600 animate-spin" />
                          </div>
                        )}
                      </div>
                    ) : null}
                  </TabsContent>

                  <TabsContent value="api" className="mt-0 outline-none space-y-3">
                    {results.length === 0 ? (
                      <div className="space-y-3.5">
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1.5">
                            <Label className="text-[9px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 ml-1">Domínio Jira</Label>
                            <Input
                              value={domain}
                              onChange={(e) => setDomain(e.target.value)}
                              placeholder="exemplo.atlassian.net"
                              className="h-10 rounded-xl text-[11px] font-bold bg-slate-50 dark:bg-slate-950 border-transparent dark:border-slate-800 focus:bg-white dark:focus:bg-slate-900 focus:border-indigo-200 dark:focus:border-indigo-950 text-slate-700 dark:text-slate-200 transition-all"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-[9px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 ml-1">Token (PAT)</Label>
                            <Input
                              type="password"
                              value={token}
                              onChange={(e) => setToken(e.target.value)}
                              placeholder="••••••••••••"
                              className="h-10 rounded-xl text-[11px] font-mono bg-slate-50 dark:bg-slate-950 border-transparent dark:border-slate-800 focus:bg-white dark:focus:bg-slate-900 focus:border-indigo-200 dark:focus:border-indigo-950 text-slate-700 dark:text-slate-200 transition-all"
                            />
                          </div>
                        </div>

                        <div className="space-y-1.5">
                           <div className="flex items-center justify-between ml-1">
                             <Label className="text-[9px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Consulta JQL</Label>
                             <Badge variant="outline" className="text-[7px] font-black uppercase border-slate-200 dark:border-slate-800 text-slate-400 dark:text-slate-400 tracking-widest bg-white dark:bg-slate-950">Filtro Avançado</Badge>
                           </div>
                          <Textarea
                            value={jql}
                            onChange={(e) => setJql(e.target.value)}
                            placeholder='Ex: sprint = 123 AND status = "In Progress"'
                            className="min-h-[72px] h-[72px] rounded-xl text-[11px] font-mono bg-slate-50 dark:bg-slate-950 border-transparent dark:border-slate-800 focus:bg-white dark:focus:bg-slate-900 focus:border-indigo-200 dark:focus:border-indigo-950 text-slate-700 dark:text-slate-200 transition-all resize-none py-2 px-3 leading-normal"
                          />
                          <div className="flex flex-wrap gap-1.5 mt-1.5">
                            {JQL_PRESETS.map((preset) => (
                              <button
                                key={preset.label}
                                type="button"
                                onClick={() => setJql(preset.jql)}
                                className="px-2.5 py-1 rounded-full text-[8px] font-black uppercase tracking-widest bg-indigo-50 dark:bg-indigo-950/35 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100/70 dark:hover:bg-indigo-950/80 border border-indigo-200/20 dark:border-indigo-900/30 transition-all cursor-pointer"
                              >
                                {preset.label}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="flex items-center gap-2.5 bg-indigo-50/40 dark:bg-indigo-950/20 p-3 rounded-xl border border-indigo-100/30 dark:border-indigo-900/30">
                          <Checkbox
                            id="save-creds"
                            checked={saveDefault}
                            onCheckedChange={(v) => setSaveDefault(!!v)}
                            className="w-4 h-4 rounded-md border-indigo-300 data-[state=checked]:bg-indigo-600 shrink-0"
                          />
                          <Label htmlFor="save-creds" className="text-[8px] font-black text-indigo-700 dark:text-indigo-400 uppercase tracking-widest cursor-pointer select-none">Lembrar credenciais para as próximas sessões</Label>
                        </div>
                      </div>
                    ) : null}
                  </TabsContent>

                  {/* Results — revisão do que voltou do Jira */}
                  {results.length > 0 && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.98 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="space-y-3"
                    >
                      <div className="flex items-center justify-between px-1 gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <Badge className="bg-indigo-600 text-white border-none font-black text-[10px] px-2 py-0.5 shrink-0">
                            {filteredResults.length === results.length ? `${results.length} itens` : `${filteredResults.length} de ${results.length}`}
                          </Badge>
                          <Badge className="bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-none font-black text-[10px] px-2 py-0.5 shrink-0">{selected.size} marcadas</Badge>
                        </div>
                        <div className="flex gap-1.5 shrink-0">
                          <Button
                            variant="ghost"
                            onClick={toggleAll}
                            className="h-7 px-2.5 text-[9px] font-black text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 uppercase tracking-widest rounded-lg"
                          >
                            {allFilteredSelected ? 'Desmarcar' : 'Marcar todas'}
                          </Button>
                          <Button
                            variant="ghost"
                            onClick={reset}
                            className="h-7 px-2.5 text-[9px] font-black text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 uppercase tracking-widest rounded-lg flex items-center"
                          >
                            <RotateCcw className="h-3 w-3 mr-1" /> Resetar
                          </Button>
                        </div>
                      </div>

                      {/* Busca + filtros por tipo/status */}
                      <div className="space-y-2 px-1">
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                          <Input
                            value={filterText}
                            onChange={(e) => setFilterText(e.target.value)}
                            placeholder="Filtrar por título, chave ou descrição..."
                            className="h-9 pl-9 pr-8 rounded-xl text-xs font-medium bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 focus:bg-white dark:focus:bg-slate-900 text-slate-700 dark:text-slate-200"
                          />
                          {filterText && (
                            <button type="button" onClick={() => setFilterText('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                              <X className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                        {(distinctTypes.length > 1 || distinctStatuses.length > 1) && (
                          <div className="flex flex-wrap items-center gap-1.5">
                            {distinctTypes.map((tp) => {
                              const active = typeFilter.has(tp);
                              const count = results.filter(r => r.type === tp).length;
                              return (
                                <button
                                  key={`t-${tp}`}
                                  type="button"
                                  onClick={() => toggleTypeFilter(tp)}
                                  className={cn(
                                    "px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wide border transition-all",
                                    active
                                      ? "bg-indigo-600 text-white border-indigo-600"
                                      : "bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-indigo-800"
                                  )}
                                >
                                  {tp} · {count}
                                </button>
                              );
                            })}
                            {distinctStatuses.length > 1 && distinctTypes.length > 1 && (
                              <span className="w-px h-4 bg-slate-200 dark:bg-slate-800 mx-0.5" />
                            )}
                            {distinctStatuses.map((st) => {
                              const active = statusFilter.has(st);
                              const count = results.filter(r => r.status === st).length;
                              return (
                                <button
                                  key={`s-${st}`}
                                  type="button"
                                  onClick={() => toggleStatusFilter(st)}
                                  className={cn(
                                    "px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wide border transition-all",
                                    active
                                      ? "bg-slate-800 text-white border-slate-800 dark:bg-slate-200 dark:text-slate-900 dark:border-slate-200"
                                      : "bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:border-slate-400 dark:hover:border-slate-600"
                                  )}
                                >
                                  {st} · {count}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      <ScrollArea className="h-[46vh] min-h-[260px] pr-3 -mr-3">
                        <div className="grid grid-cols-1 gap-2.5 pb-4">
                          {filteredResults.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-16 text-center text-slate-400">
                              <Search className="h-6 w-6 mb-2 opacity-40" />
                              <p className="text-[11px] font-black uppercase tracking-widest">Nenhum item bate o filtro</p>
                            </div>
                          ) : filteredResults.map((r) => {
                            const isSel = selected.has(r.key);
                            const isOpen = expanded.has(r.key);
                            const hasDetail = !!(r.description || r.acceptanceCriteria);
                            return (
                              <div
                                key={r.key}
                                onClick={() => toggleSelect(r.key)}
                                className={cn(
                                  "group rounded-xl transition-all cursor-pointer border",
                                  isSel
                                    ? "bg-indigo-50/50 dark:bg-indigo-950/25 border-indigo-200 dark:border-indigo-900 shadow-xs"
                                    : "bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 hover:border-slate-200 dark:hover:border-slate-700 hover:bg-slate-50/50 dark:hover:bg-slate-850/50"
                                )}
                              >
                                <div className="flex items-start gap-3 p-3">
                                  <Checkbox
                                    checked={isSel}
                                    onCheckedChange={() => toggleSelect(r.key)}
                                    onClick={(e) => e.stopPropagation()}
                                    className="w-4 h-4 rounded-md border-slate-300 data-[state=checked]:bg-indigo-600 shrink-0 mt-0.5"
                                  />
                                  <div className="flex-1 min-w-0">
                                    <div className="flex flex-wrap items-center gap-1.5 mb-1">
                                      <span className="text-[11px] font-black text-indigo-600 dark:text-indigo-400 tracking-wide">{r.key}</span>
                                      {r.type && (
                                        <Badge variant="outline" className="text-[8px] font-black px-1.5 py-0 h-4 uppercase border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 tracking-wide bg-white dark:bg-slate-950">
                                          {r.type}
                                        </Badge>
                                      )}
                                      {r.status && (
                                        <span className={cn("px-1.5 py-0.5 rounded-md text-[8px] font-black uppercase tracking-wide", statusClasses(r.status))}>
                                          {r.status}
                                        </span>
                                      )}
                                      {r.priority && (
                                        <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 capitalize">• {r.priority}</span>
                                      )}
                                      {r.points > 0 && (
                                        <span className="ml-auto shrink-0 text-[9px] font-black text-slate-500 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded-md">
                                          {r.points} pts
                                        </span>
                                      )}
                                    </div>
                                    <h4 className="text-[13px] font-bold text-slate-800 dark:text-slate-100 leading-snug line-clamp-2 group-hover:text-indigo-600 transition-colors">
                                      {r.title}
                                    </h4>
                                    {stripHtml(r.description) && (
                                      <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed line-clamp-2 mt-1">
                                        {stripHtml(r.description)}
                                      </p>
                                    )}
                                    <div className="flex items-center flex-wrap gap-x-3 gap-y-1 mt-1.5">
                                      {r.assignee && (
                                        <p className="text-[9px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wide truncate">
                                          Resp: <span className="text-slate-600 dark:text-slate-300">{r.assignee}</span>
                                        </p>
                                      )}
                                      {r.labels && r.labels.length > 0 && (
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                          {r.labels.slice(0, 3).map((lb) => (
                                            <span key={lb} className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wide text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded px-1.5 py-0.5">
                                              <Tag className="h-2.5 w-2.5" />{lb}
                                            </span>
                                          ))}
                                          {r.labels.length > 3 && (
                                            <span className="text-[9px] font-bold text-slate-400">+{r.labels.length - 3}</span>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                  {hasDetail && (
                                    <button
                                      type="button"
                                      onClick={(e) => { e.stopPropagation(); toggleExpand(r.key); }}
                                      className="shrink-0 mt-1 p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 transition-all"
                                      aria-label={isOpen ? 'Recolher detalhes' : 'Ver detalhes'}
                                    >
                                      <ChevronDown className={cn("h-5 w-5 transition-transform", isOpen && "rotate-180")} />
                                    </button>
                                  )}
                                </div>

                                {isOpen && hasDetail && (
                                  <div
                                    className="border-t border-slate-100 dark:border-slate-800 px-4 py-3.5 space-y-3.5 bg-slate-50/40 dark:bg-slate-950/30 rounded-b-xl"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    {r.description && (
                                      <div className="space-y-1.5">
                                        <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Descrição</span>
                                        <p className="text-[12px] leading-relaxed text-slate-600 dark:text-slate-300 whitespace-pre-line">
                                          {r.description}
                                        </p>
                                      </div>
                                    )}
                                    {r.acceptanceCriteria && (
                                      <div className="space-y-1.5">
                                        <span className="text-[9px] font-black uppercase tracking-widest text-emerald-500 dark:text-emerald-400">Critérios de Aceite</span>
                                        <p className="text-[12px] leading-relaxed text-slate-600 dark:text-slate-300 whitespace-pre-line">
                                          {r.acceptanceCriteria}
                                        </p>
                                      </div>
                                    )}
                                    {r.url && (
                                      <a
                                        href={r.url}
                                        target="_blank"
                                        rel="noreferrer"
                                        onClick={(e) => e.stopPropagation()}
                                        className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400 hover:underline"
                                      >
                                        <ExternalLink className="h-3 w-3" /> Abrir no Jira
                                      </a>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </ScrollArea>
                    </motion.div>
                  )}
                </motion.div>
              </AnimatePresence>
            </div>
          </Tabs>
        </div>

        <DialogFooter className="p-4 px-6 bg-slate-50 dark:bg-slate-950 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0">
          <div className="hidden md:flex flex-col">
            <span className="text-[8px] font-black uppercase text-slate-400 dark:text-slate-400 tracking-widest">
              Status de Importação
            </span>
            <span className="text-xs font-black text-slate-900 dark:text-slate-200 tracking-tight italic">
              {results.length > 0 ? (
                <>{selected.size} <span className="text-indigo-600 dark:text-indigo-400">itens</span> selecionados</>
              ) : (
                tab === 'xml' ? 'Aguardando arquivo...' : 'Preencha os filtros...'
              )}
            </span>
          </div>
          <div className="flex gap-2 w-full md:w-auto justify-end">
            <Button
              variant="outline"
              onClick={() => { reset(); onClose(); }}
              className="h-10 px-5 rounded-xl font-black uppercase text-[9px] tracking-widest text-slate-500 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-900 transition-all border-slate-200 dark:border-slate-800"
            >
              Cancelar
            </Button>
            
            {results.length === 0 ? (
              tab === 'xml' ? (
                <div className="relative">
                  <Button
                    className="h-10 px-6 bg-indigo-600 hover:bg-indigo-700 text-white font-black uppercase tracking-[0.1em] text-[10px] rounded-xl shadow-xl shadow-indigo-600/10 transition-all active:scale-95 flex-1 md:flex-none"
                  >
                    <FileUp className="h-3.5 w-3.5 mr-1.5" /> Selecionar XML
                  </Button>
                  <input type="file" accept=".xml" multiple className="absolute inset-0 opacity-0 cursor-pointer" onChange={handleXml} disabled={loading} />
                </div>
              ) : (
                <Button
                  onClick={handleApiSearch}
                  disabled={loading || !domain || !token || !jql}
                  className="h-10 px-6 bg-indigo-600 hover:bg-indigo-700 text-white font-black uppercase tracking-[0.1em] text-[10px] rounded-xl shadow-xl shadow-indigo-600/10 transition-all active:scale-95 flex-1 md:flex-none"
                >
                  {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Search className="h-3.5 w-3.5 mr-1.5" />}
                  Buscar no Jira
                </Button>
              )
            ) : (
              <div className="flex gap-2">
                {tab === 'api' && (
                  <Button
                    variant="ghost"
                    onClick={() => setResults([])}
                    className="h-10 px-4 rounded-xl font-black uppercase text-[9px] tracking-widest text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/45 transition-all border border-indigo-100 dark:border-indigo-900/50"
                  >
                    <Search className="h-3.5 w-3.5 mr-1.5" /> Outra Busca
                  </Button>
                )}
                <Button
                  onClick={handleConfirmImport}
                  disabled={selected.size === 0}
                  className="h-10 px-6 bg-indigo-600 hover:bg-indigo-700 text-white font-black uppercase tracking-[0.1em] text-[10px] rounded-xl shadow-xl shadow-indigo-600/10 transition-all active:scale-95 disabled:opacity-50 flex-1 md:flex-none"
                >
                  Importar Selecionados ({selected.size})
                </Button>
              </div>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

'use client';

import React from 'react';
import { sanitizeHtml } from '@/lib/sanitize-html';
import { 
  FileText, 
  Tag, 
  Clock, 
  User, 
  ExternalLink,
  X,
  Hash,
  Bookmark,
  Bug as BugIcon,
  Zap,
  CheckSquare,
  AlertCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { motion, AnimatePresence } from 'framer-motion';

interface JiraIssue {
  key: string;
  summary: string;
  description: string;
  type?: string;
  status?: string;
  priority?: string;
  assignee?: string;
  updated?: string;
  labels?: string[];
  points?: number;
  link?: string;
  acceptanceCriteria?: string;
}

interface IssueDetailProps {
  issue: JiraIssue | null;
  isOpen: boolean;
  onClose: () => void;
}

export function IssueDetail({ issue, isOpen, onClose }: IssueDetailProps) {
  if (!issue) return null;

  const getIssueTypeConfig = (type?: string) => {
    const t = type?.toLowerCase() || '';
    if (t.includes('story') || t.includes('estória')) return { icon: Bookmark, color: 'text-emerald-500', bg: 'bg-emerald-500/10' };
    if (t.includes('bug') || t.includes('erro')) return { icon: BugIcon, color: 'text-red-500', bg: 'bg-red-500/10' };
    if (t.includes('epic') || t.includes('épico')) return { icon: Zap, color: 'text-purple-500', bg: 'bg-purple-500/10' };
    if (t.includes('task') || t.includes('tarefa')) return { icon: CheckSquare, color: 'text-blue-500', bg: 'bg-blue-500/10' };
    return { icon: Hash, color: 'text-indigo-500', bg: 'bg-indigo-500/10' };
  };

  const typeConfig = getIssueTypeConfig(issue.type);
  const TypeIcon = typeConfig.icon;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100]"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed inset-0 flex items-center justify-center z-[101] p-4 pointer-events-none"
          >
            <div className="bg-white dark:bg-slate-900 w-full max-w-7xl h-[90vh] rounded-[2.5rem] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.3)] border border-white/20 overflow-hidden flex flex-col pointer-events-auto">
              {/* Header */}
              <div className="px-8 py-5 relative shrink-0 bg-gradient-to-br from-indigo-50/50 to-white dark:from-indigo-950/20 dark:to-slate-900 border-b border-slate-100 dark:border-slate-800/50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className={`h-11 w-11 rounded-xl ${typeConfig.bg} shadow-sm flex items-center justify-center ${typeConfig.color} shrink-0`}>
                      <TypeIcon className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">{issue.key}</span>
                        {issue.type && (
                          <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${typeConfig.bg} ${typeConfig.color}`}>
                            {issue.type}
                          </span>
                        )}
                        {issue.status && (
                          <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600">
                            {issue.status}
                          </span>
                        )}
                        {issue.priority && (
                          <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600">
                            {issue.priority}
                          </span>
                        )}
                      </div>
                      <h2 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight leading-tight">
                        {issue.summary || 'Sem Título'}
                      </h2>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {issue.link && (
                      <Button asChild variant="ghost" size="sm" className="rounded-xl text-[10px] font-bold uppercase tracking-widest text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 gap-2">
                        <a href={issue.link} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="h-3.5 w-3.5" />
                          Jira
                        </a>
                      </Button>
                    )}
                    <Button variant="ghost" size="icon" onClick={onClose} className="rounded-xl hover:bg-red-50 hover:text-red-500">
                      <X className="h-5 w-5" />
                    </Button>
                  </div>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto px-8 py-6 custom-scrollbar bg-white dark:bg-slate-900">
                <div className="space-y-8 pb-12">
                  {/* Info Cards */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800">
                      <div className="flex items-center gap-2 mb-1 text-slate-400">
                        <User className="h-3 w-3" />
                        <span className="text-[9px] font-bold uppercase tracking-widest">Relator / Assignee</span>
                      </div>
                      <p className="text-xs font-bold text-slate-700 dark:text-slate-300">{issue.assignee || 'Não atribuído'}</p>
                    </div>
                    <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800">
                      <div className="flex items-center gap-2 mb-1 text-slate-400">
                        <Clock className="h-3 w-3" />
                        <span className="text-[9px] font-bold uppercase tracking-widest">Última Atualização</span>
                      </div>
                      <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
                        {issue.updated ? new Date(issue.updated).toLocaleDateString('pt-BR') : 'N/A'}
                      </p>
                    </div>
                  </div>

                  {/* Description */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-indigo-600" />
                      <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Descrição Detalhada</h3>
                    </div>
                    <div className="bg-slate-50/50 dark:bg-slate-800/20 p-4 rounded-2xl border border-slate-100 dark:border-slate-800/50 prose dark:prose-invert prose-sm max-w-none">
                      {issue.description ? (
                        <div 
                          className="text-slate-700 dark:text-slate-300 text-xs leading-relaxed"
                          dangerouslySetInnerHTML={{
                            __html: sanitizeHtml(issue.description.includes('<') ? issue.description : `<p>${issue.description}</p>`)
                          }}
                        />
                      ) : (
                        <div className="flex items-center justify-center py-20 text-slate-400 italic gap-3">
                          <AlertCircle className="h-6 w-6 opacity-30" />
                          <p className="text-sm">Nenhuma descrição detalhada disponível para esta tarefa.</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Critérios de Aceite */}
                  {issue.acceptanceCriteria && (
                    <div className="space-y-4">
                      <div className="flex items-center gap-2">
                        <CheckSquare className="h-4 w-4 text-emerald-600" />
                        <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Critérios de Aceite</h3>
                      </div>
                      <div className="bg-emerald-50/40 dark:bg-emerald-950/10 p-4 rounded-2xl border border-emerald-100 dark:border-emerald-900/30 prose dark:prose-invert prose-sm max-w-none">
                        <div
                          className="text-slate-700 dark:text-slate-300 text-xs leading-relaxed"
                          dangerouslySetInnerHTML={{
                            __html: sanitizeHtml(issue.acceptanceCriteria.includes('<') ? issue.acceptanceCriteria : `<p>${issue.acceptanceCriteria}</p>`)
                          }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Labels */}
                  {issue.labels && issue.labels.length > 0 && (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <Tag className="h-4 w-4 text-indigo-600" />
                        <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Marcadores</h3>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {issue.labels.map(label => (
                          <span key={label} className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-lg text-[9px] font-bold uppercase tracking-widest border border-slate-200 dark:border-slate-700">
                            {label}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

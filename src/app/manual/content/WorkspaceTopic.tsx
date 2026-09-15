import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { LayoutGrid, Code2, Zap, ShieldCheck, Bookmark, Sparkles } from 'lucide-react';
import { ManualHero } from '../components/ManualHero';
import { getTopicById } from '../data/topics';

export function WorkspaceTopic() {
  const meta = getTopicById('workspace')!;

  return (
    <div className="space-y-10 animate-in fade-in duration-500">
      <ManualHero
        title={meta.title}
        subtitle={meta.subtitle}
        description={meta.description}
        icon={meta.icon}
        color={meta.color}
        badgeBg={meta.badgeBg}
        badgeBorder={meta.badgeBorder}
        badgeText={meta.badgeText}
        actionUrl={meta.actionUrl}
        actionLabel={meta.actionLabel}
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-4 space-y-6">
          <div className="p-8 bg-slate-900 rounded-[2.5rem] text-white shadow-2xl space-y-6">
            <h4 className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-primary">
              <Sparkles className="h-4 w-4" /> Produtividade Solo
            </h4>
            <p className="text-xs text-slate-300 font-medium leading-relaxed italic">
              &quot;O sucesso da squad começa na excelência individual. O Workspace elimina o atrito entre a ideação e o registro técnico.&quot;
            </p>
          </div>
        </div>

        <div className="lg:col-span-8">
          <Card className="border-none bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-xl shadow-slate-200/40 dark:shadow-none overflow-hidden">
            <CardHeader className="p-8 pb-4 border-b border-slate-100 dark:border-slate-800">
              <CardTitle className="text-xl font-black uppercase tracking-tight text-slate-900 dark:text-slate-100">
                Ferramentas de Comando Pessoal
              </CardTitle>
              <CardDescription className="text-xs font-medium">
                Recursos para potencializar sua rotina diária como desenvolvedor.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-8 space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="p-6 rounded-3xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                      <Zap className="h-5 w-5" />
                    </div>
                    <h4 className="font-black uppercase tracking-widest text-xs text-slate-900 dark:text-slate-100">
                      Daily Helper
                    </h4>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed font-medium">
                    Prepare seu status da Daily com tranquilidade. O sistema possui auto-save em tempo real e permite copiar em formato markdown pronto para Slack ou Discord com um único clique.
                  </p>
                </div>

                <div className="p-6 rounded-3xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                      <Code2 className="h-5 w-5" />
                    </div>
                    <h4 className="font-black uppercase tracking-widest text-xs text-slate-900 dark:text-slate-100">
                      Snippet Library
                    </h4>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed font-medium">
                    Seu bloco de notas técnico privado. Guarde queries complexas, scripts Docker, templates cURL e trechos de código com Syntax Highlighting por linguagem.
                  </p>
                </div>
              </div>

              <div className="p-6 bg-slate-50 dark:bg-slate-800/40 rounded-3xl border border-slate-200/60 dark:border-slate-800 flex items-center gap-4">
                <ShieldCheck className="h-8 w-8 text-emerald-500 shrink-0" />
                <div className="space-y-1">
                  <h5 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-slate-100">
                    Isolamento por Identidade (UID)
                  </h5>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                    Seus dados pessoais de rascunho e snippets não são visíveis para outros membros nem misturados com as salas comunitárias.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

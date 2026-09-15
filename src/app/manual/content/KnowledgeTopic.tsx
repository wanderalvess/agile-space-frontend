import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Sparkles, Key, MessageSquare, Database, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { ManualHero } from '../components/ManualHero';
import { ModuleApiToolSection } from '../components/ModuleApiToolSection';
import { getTopicById } from '../data/topics';

export function KnowledgeTopic() {
  const meta = getTopicById('knowledge')!;

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
          <div className="p-8 bg-cyan-600 rounded-[2.5rem] text-white shadow-2xl shadow-cyan-500/20 space-y-4">
            <h4 className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-cyan-100">
              <ShieldCheck className="h-4 w-4" /> Sua Chave, Seu Controle
            </h4>
            <p className="text-xs text-cyan-100/90 leading-relaxed font-medium italic">
              &quot;Privacidade em primeiro lugar: sua API Key do Google AI Studio fica guardada apenas no seu próprio navegador via LocalStorage. O servidor nunca persiste nem compartilha suas credenciais.&quot;
            </p>
          </div>
        </div>

        <div className="lg:col-span-8">
          <Card className="border-none bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-xl shadow-slate-200/40 dark:shadow-none overflow-hidden">
            <CardHeader className="p-8 pb-4 border-b border-slate-100 dark:border-slate-800">
              <CardTitle className="text-xl font-black uppercase tracking-tight text-slate-900 dark:text-slate-100">
                Manual de Operação da Wiki & Assistente
              </CardTitle>
              <CardDescription className="text-xs font-medium">
                Alimente a base de conhecimento e use o assistente para responder dúvidas do projeto.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-8 space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="p-6 rounded-3xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-cyan-500 text-white flex items-center justify-center font-black text-xs">
                      01
                    </div>
                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-slate-100">
                      Configuração de Key
                    </h4>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
                    Obtenha sua chave gratuita no Google AI Studio (Gemini Flash) e cole no painel de Configurações do módulo.
                  </p>
                </div>

                <div className="p-6 rounded-3xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-cyan-500 text-white flex items-center justify-center font-black text-xs">
                      02
                    </div>
                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-slate-100">
                      Gestão de Artigos
                    </h4>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
                    Crie e edite manuais técnicos em formato Markdown com suporte a diagramas, código-fonte e categorias.
                  </p>
                </div>

                <div className="p-6 rounded-3xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-cyan-500 text-white flex items-center justify-center font-black text-xs">
                      03
                    </div>
                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-slate-100">
                      Assistente Contextual
                    </h4>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
                    Inicie conversas com respostas geradas por streaming e fundamentadas diretamente nos documentos salvos da squad.
                  </p>
                </div>

                <div className="p-6 rounded-3xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-cyan-500 text-white flex items-center justify-center font-black text-xs">
                      04
                    </div>
                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-slate-100">
                      Lixeira Comunitária
                    </h4>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
                    Documentos excluídos ficam retidos por 30 dias na lixeira, permitindo restauração rápida por qualquer membro autorizado.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Seção Detalhada de API e MCP Tools */}
      <ModuleApiToolSection moduleId="knowledge" />
    </div>
  );
}

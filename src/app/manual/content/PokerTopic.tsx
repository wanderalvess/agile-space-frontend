import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { CheckCircle2, Info, Shield, Zap, Sparkles } from 'lucide-react';
import { ManualHero } from '../components/ManualHero';
import { getTopicById } from '../data/topics';

export function PokerTopic() {
  const meta = getTopicById('poker')!;

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

      {/* Grid: Context & Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Col: Mindset & Strategy */}
        <div className="lg:col-span-4 space-y-6">
          <div className="p-8 bg-blue-600 rounded-[2.5rem] text-white shadow-2xl shadow-blue-500/20 space-y-4">
            <h4 className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-blue-100">
              <Shield className="h-4 w-4" /> Vantagem Estratégica
            </h4>
            <p className="text-sm font-medium leading-relaxed italic opacity-95">
              &quot;Ao ocultar os votos, forçamos o cérebro a pensar de forma independente. O valor não está no número final, mas na discussão que surge quando as opiniões divergem.&quot;
            </p>
          </div>

          <div className="p-6 bg-slate-50 dark:bg-slate-900 rounded-[2rem] border border-slate-200/80 dark:border-slate-800 space-y-3">
            <h5 className="text-[11px] font-black uppercase tracking-widest text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Zap className="h-4 w-4 text-amber-500" /> Deck Recomendado
            </h5>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-medium">
              Utilize a sequência de <strong>Fibonacci (1, 2, 3, 5, 8, 13, 21)</strong> para User Stories inteiras. Para desdobramento de sub-tarefas técnicas em refinamento fino, alterne para o deck de <strong>Horas</strong>.
            </p>
          </div>
        </div>

        {/* Right Col: 4-Step Walkthrough */}
        <div className="lg:col-span-8">
          <Card className="border-none bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-xl shadow-slate-200/40 dark:shadow-none overflow-hidden">
            <CardHeader className="p-8 pb-4 border-b border-slate-100 dark:border-slate-800">
              <CardTitle className="text-xl font-black uppercase tracking-tight text-slate-900 dark:text-slate-100">
                Manual de Operação Passo a Passo
              </CardTitle>
              <CardDescription className="text-xs font-medium">
                Siga este fluxo para conduzir uma rodada de estimativas ágil e sem atrito.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-8 space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-3 p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center font-black text-xs shadow-sm">
                      01
                    </div>
                    <h4 className="font-black uppercase tracking-widest text-xs text-slate-900 dark:text-slate-100">
                      Criação & Pauta
                    </h4>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-medium">
                    O facilitador cria a sala e adiciona os itens na aba <strong>Tarefas</strong>. Cada item pode conter o link da issue no Jira e notas com critérios de aceite para consulta rápida do time.
                  </p>
                </div>

                <div className="space-y-3 p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center font-black text-xs shadow-sm">
                      02
                    </div>
                    <h4 className="font-black uppercase tracking-widest text-xs text-slate-900 dark:text-slate-100">
                      Escolha do Deck
                    </h4>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-medium">
                    Alterne entre <strong>Fibonacci</strong> (padrão Scrum) ou <strong>Horas</strong>. Isso atualiza instantaneamente as cartas interativas disponíveis no painel de cada participante conectado.
                  </p>
                </div>

                <div className="space-y-3 p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center font-black text-xs shadow-sm">
                      03
                    </div>
                    <h4 className="font-black uppercase tracking-widest text-xs text-slate-900 dark:text-slate-100">
                      Votação Silenciosa
                    </h4>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-medium">
                    Os participantes escolhem suas cartas em sigilo. O sistema exibe um indicador visual de quem já concluiu o voto, mas os valores só aparecem após o comando de <strong>Revelação</strong>.
                  </p>
                </div>

                <div className="space-y-3 p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center font-black text-xs shadow-sm">
                      04
                    </div>
                    <h4 className="font-black uppercase tracking-widest text-xs text-slate-900 dark:text-slate-100">
                      Revelação & Consenso
                    </h4>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-medium">
                    Ao revelar, o sistema detecta desvios: as menores e maiores estimativas explicam seus pontos de vista técnicos. Após o alinhamento, o facilitador <strong>Salva o Consenso</strong>.
                  </p>
                </div>
              </div>

              {/* Responsibilities */}
              <div className="p-6 bg-slate-50 dark:bg-slate-800/60 rounded-3xl border border-slate-200/60 dark:border-slate-700/60 space-y-4">
                <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-600 dark:text-blue-400 flex items-center gap-2">
                  <Info className="h-4 w-4" /> Funções Exclusivas do Facilitador
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex gap-3 items-start">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
                    <p className="text-xs text-slate-600 dark:text-slate-300 font-medium">Pular tarefas (Skipped) caso o time julgue não prioritário para a rodada.</p>
                  </div>
                  <div className="flex gap-3 items-start">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
                    <p className="text-xs text-slate-600 dark:text-slate-300 font-medium">Editar estimativas individuais se algum membro errar o clique.</p>
                  </div>
                  <div className="flex gap-3 items-start">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
                    <p className="text-xs text-slate-600 dark:text-slate-300 font-medium">Comando &quot;Limpar Mesa&quot; para resetar votos e avançar para a próxima história.</p>
                  </div>
                  <div className="flex gap-3 items-start">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
                    <p className="text-xs text-slate-600 dark:text-slate-300 font-medium">Exportar relatório consolidado com médias, consensos e histórico em CSV/PDF.</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

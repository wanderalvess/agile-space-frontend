import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { FileJson, Terminal, Sparkles, Network, ArrowRight } from 'lucide-react';
import { ManualHero } from '../components/ManualHero';
import { getTopicById } from '../data/topics';

export function JoltTopic() {
  const meta = getTopicById('jolt')!;

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
        <div className="lg:col-span-12">
          <Card className="border-none bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-xl shadow-slate-200/40 dark:shadow-none overflow-hidden">
            <div className="grid grid-cols-1 md:grid-cols-2">
              <div className="p-8 md:p-10 space-y-6 border-b md:border-b-0 md:border-r border-slate-100 dark:border-slate-800">
                <div className="space-y-3">
                  <Badge className="bg-blue-600 uppercase text-[9px] font-black tracking-widest text-white">
                    Engine Apache Jolt
                  </Badge>
                  <h4 className="text-2xl font-black uppercase tracking-tight text-slate-900 dark:text-slate-100">
                    Operadores Nativos
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
                    O motor integrado executa transformações JSON estruturais de alta performance:
                  </p>
                </div>

                <div className="space-y-4">
                  {[
                    { op: "shift", desc: "Mapeamento estrutural chave a chave com suporte a curingas (*) e branching condicional complexo." },
                    { op: "default", desc: "Injeta valores padrão e campos ausentes em massa de forma segura." },
                    { op: "cardinality", desc: "Normaliza atributos entre Objeto e Array (ONE vs MANY) para estabilizar APIs externas." },
                    { op: "sort", desc: "Ordenação alfabética profunda das propriedades de todo o payload gerado." }
                  ].map((item, i) => (
                    <div key={i} className="flex gap-4 items-start">
                      <code className="text-[11px] font-mono font-black bg-slate-900 text-blue-400 dark:bg-slate-800 px-2.5 py-1 rounded-lg shrink-0">
                        {item.op}
                      </code>
                      <p className="text-xs text-slate-600 dark:text-slate-300 font-medium leading-relaxed">
                        {item.desc}
                      </p>
                    </div>
                  ))}
                </div>

                <div className="p-6 bg-blue-50/70 dark:bg-slate-800/60 rounded-3xl border border-blue-100 dark:border-slate-700 flex gap-4">
                  <Sparkles className="h-6 w-6 text-blue-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-[10px] font-black uppercase text-blue-700 dark:text-blue-400 tracking-widest mb-1">
                      Dica Pro: Macros de Caminho
                    </p>
                    <p className="text-xs text-blue-900/80 dark:text-slate-300 font-medium leading-relaxed">
                      Utilize <code>&1</code> para referenciar o nome do nó um nível acima, ou <code>$</code> para extrair o valor da própria chave de entrada.
                    </p>
                  </div>
                </div>
              </div>

              {/* Sandbox & Visual Mapper */}
              <div className="p-8 md:p-10 bg-slate-900 text-white space-y-6 flex flex-col justify-center">
                <div className="flex items-center gap-2">
                  <Terminal className="h-4 w-4 text-blue-400" />
                  <h4 className="text-xs font-black uppercase tracking-widest text-slate-200">
                    Módulos Inclusos na Suíte
                  </h4>
                </div>

                <div className="space-y-4">
                  <div className="p-6 bg-white/5 border border-white/10 rounded-3xl space-y-2 hover:bg-white/10 transition-colors">
                    <h5 className="text-xs font-black uppercase text-white">
                      Transformador Jolt (Sandbox Monaco)
                    </h5>
                    <p className="text-xs text-slate-400 font-medium leading-relaxed">
                      Editores Monaco lado a lado para JSON de entrada, Spec Jolt e resultado computado em tempo real, com destaque de erros de sintaxe.
                    </p>
                  </div>

                  <div className="p-6 bg-white/5 border border-white/10 rounded-3xl space-y-2 hover:bg-white/10 transition-colors">
                    <h5 className="text-xs font-black uppercase text-white">
                      Mapeador Visual (ReactFlow)
                    </h5>
                    <p className="text-xs text-slate-400 font-medium leading-relaxed">
                      Interface gráfica para criar mapeamentos complexos apenas arrastando nós e conexões, gerando a spec Jolt correspondente automaticamente.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

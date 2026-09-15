import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { HelpCircle, Fingerprint, Zap, Download, ShieldCheck, Sparkles } from 'lucide-react';
import { ManualHero } from '../components/ManualHero';
import { getTopicById } from '../data/topics';

export function ManifestoTopic() {
  const meta = getTopicById('manifesto')!;

  const principles = [
    { 
      icon: HelpCircle, 
      title: "Help First", 
      desc: "Nenhuma funcionalidade é considerada 'done' sem um guia de 'Como Usar' embutido e acessível diretamente no cabeçalho do módulo." 
    },
    { 
      icon: Fingerprint, 
      title: "Privacy Radical", 
      desc: "Votações e diagnósticos de saúde são anônimos por design. O sistema não armazena ligações entre o voto individual e a pessoa que votou." 
    },
    { 
      icon: Zap, 
      title: "Real-Time Sync", 
      desc: "Sincronização reativa de baixa latência em todas as salas de cerimônia para garantir que todos vejam o mesmo estado sem refresh." 
    },
    { 
      icon: Download, 
      title: "Export Ready", 
      desc: "Resultados de cerimônias e utilitários técnicos devem ser exportáveis em PDF estruturado ou CSV para alimentar a governança do time." 
    }
  ];

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
      />

      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {principles.map((rule, i) => (
            <div 
              key={i} 
              className="p-8 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-sm hover:shadow-lg transition-all space-y-4 group"
            >
              <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                <rule.icon className="h-6 w-6 text-primary" />
              </div>
              <h4 className="font-black uppercase tracking-widest text-xs text-slate-900 dark:text-slate-100">
                {rule.title}
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-medium">
                {rule.desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

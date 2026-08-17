"use client";

import React from 'react';
import { 
  BookOpen, 
  Sparkles, 
  Search, 
  MessageSquare, 
  Database, 
  Settings, 
  ShieldCheck,
  Zap,
  ArrowRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';

export default function ManualPage() {
  const router = useRouter();

  const sections = [
    {
      title: "Base de Conhecimento Compartilhada",
      desc: "Como alimentar a base de conhecimento do Agile Space.",
      icon: Database,
      items: [
        "Acesse o 'Gestor de Ativos' para inserir novos documentos Markdown.",
        "Categorize seus documentos para facilitar a busca avançada.",
        "Todos os membros podem editar e evoluir as informações da Wiki."
      ]
    },
    {
      title: "Assistente de Agilidade",
      desc: "Interagindo com o assistente virtual para resolver dúvidas.",
      icon: MessageSquare,
      items: [
        "O chat utiliza apenas a base indexada para garantir respostas precisas.",
        "Seus chats são privados e não podem ser vistos por outros usuários.",
        "Configure suas próprias chaves de API (Gemini, OpenAI, Anthropic) no painel de configurações."
      ]
    },
    {
      title: "Segurança e Governança",
      desc: "Proteção de dados e lixeira compartilhada.",
      icon: ShieldCheck,
      items: [
        "Documentos excluídos vão para a 'Lixeira' por 30 dias.",
        "A lixeira é comunitária: qualquer membro pode restaurar um ativo importante.",
        "Chaves de acesso são armazenadas de forma segura e cifrada."
      ]
    }
  ];

  return (
    <div className="p-6 lg:p-10 max-w-full mx-auto space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-20 bg-white">
      {/* Header */}
      <div className="flex flex-col md:flex-row items-center gap-8 justify-between border-b border-slate-100 pb-8">
        <div className="space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-slate-900 rounded-full">
             <BookOpen className="h-3 w-3 text-cyan-400" />
             <span className="text-[9px] font-black uppercase tracking-widest text-white">Manual do Operador</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-black font-headline uppercase tracking-tighter italic text-slate-900 leading-none">
            Manual de <span className="text-cyan-600 not-italic">Operação v3.5</span>
          </h1>
          <p className="text-[11px] text-slate-500 font-bold uppercase tracking-widest leading-relaxed">
            Guia de operação e expansão da base de conhecimento.
          </p>
        </div>
        <div className="flex gap-4">
           <Button onClick={() => router.push('/knowledge/kb')} className="h-10 px-6 rounded-xl bg-slate-900 text-white font-black uppercase text-[9px] tracking-widest">Explorar Wiki</Button>
        </div>
      </div>

      {/* Manual Content */}
      <div className="grid md:grid-cols-3 gap-6">
        {sections.map((section, i) => (
          <div key={i} className="group p-6 bg-slate-50 border border-slate-200 rounded-[2rem] hover:bg-white hover:border-cyan-400 transition-all flex flex-col justify-between">
             <div className="space-y-6">
                <div className="flex items-center gap-3">
                   <div className="w-10 h-10 bg-slate-900 rounded-xl flex items-center justify-center">
                      <section.icon className="h-5 w-5 text-cyan-400" />
                   </div>
                   <div>
                     <h2 className="text-lg font-black uppercase tracking-tighter text-slate-900 italic leading-none">{section.title}</h2>
                     <p className="text-[8px] font-black uppercase tracking-widest text-slate-400 mt-1">{section.desc}</p>
                   </div>
                </div>

                <ul className="space-y-3">
                  {section.items.map((item, j) => (
                    <li key={j} className="flex items-start gap-3">
                       <div className="mt-1 w-3.5 h-3.5 rounded-full border border-cyan-500 flex items-center justify-center shrink-0">
                          <div className="w-1 h-1 bg-cyan-500 rounded-full" />
                       </div>
                       <p className="text-[11px] font-bold text-slate-700 uppercase tracking-tight leading-snug">{item}</p>
                    </li>
                  ))}
                </ul>
             </div>
          </div>
        ))}
      </div>

      {/* Final Call to Action */}
      <div className="p-12 bg-slate-900 rounded-[3.5rem] text-center space-y-8 shadow-3xl shadow-slate-900/20 relative overflow-hidden group">
         <div className="absolute inset-0 bg-gradient-to-r from-cyan-600/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
         <Zap className="h-12 w-12 text-cyan-400 mx-auto animate-pulse" />
         <h3 className="text-4xl font-black font-headline uppercase tracking-tighter text-white italic">Pronto para começar?</h3>
         <div className="flex flex-wrap justify-center gap-4">
           <Button onClick={() => router.push('/knowledge/kb')} className="h-14 px-8 rounded-2xl bg-white text-slate-900 font-black uppercase text-[10px] tracking-widest hover:scale-105 transition-transform">Explorar Base</Button>
           <Button onClick={() => router.push('/knowledge/chat')} variant="outline" className="h-14 px-8 rounded-2xl border-white/20 text-white font-black uppercase text-[10px] tracking-widest hover:bg-white/10">Ir para o Assistente</Button>
         </div>
      </div>
    </div>
  );
}

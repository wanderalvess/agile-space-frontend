import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Terminal, FileJson, ShieldCheck, Zap, ArrowRight } from 'lucide-react';
import { ManualHero } from '../components/ManualHero';
import { getTopicById } from '../data/topics';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export function DevToolsTopic() {
  const meta = getTopicById('devtools')!;

  const categories = [
    {
      title: "Dados & Transformação",
      icon: FileJson,
      color: "text-indigo-600 dark:text-indigo-400",
      tools: [
        {
          t: "Gerador de Modelos (Classes/Interfaces)",
          d: "Infera interfaces TypeScript, classes Java ou Delphi a partir de payloads JSON brutos.",
          tip: "Suporta geração recursiva. Ótimo para documentar contratos de integração rapidamente."
        },
        {
          t: "Formatador e Validador JSON",
          d: "Engine com ponteiro de erro por linha, beautify e minificação de payloads gigantes.",
          tip: "Identifica a coluna e linha exata de caracteres inválidos em responses de APIs."
        },
        {
          t: "Conversor e Formatador XML",
          d: "Motor de formatação XML robusto (stack-based) com conversão bidirecional para JSON.",
          tip: "Lida com namespaces complexos e atributos múltiplos sem corromper a árvore hierárquica."
        }
      ]
    },
    {
      title: "Segurança & Geradores",
      icon: ShieldCheck,
      color: "text-emerald-600 dark:text-emerald-400",
      tools: [
        {
          t: "Decodificador Universal (Deep)",
          d: "Analisa payloads em Base64, JWT decodificado e URIs aninhadas com decodificação recursiva.",
          tip: "Detecta automaticamente a assinatura de tokens JWT e payloads codificados."
        },
        {
          t: "Gerador de Documentos Válidos",
          d: "Gera CPFs e CNPJs válidos, incluindo o novo formato Alfanumérico, para validações e testes.",
          tip: "Permite gerar lotes com ou sem máscara para colar direto em seeds de QA."
        },
        {
          t: "Fábrica de Mocks Realistas",
          d: "Gera coleções de registros mockados a partir de schemas JSON ou DDL SQL de tabelas.",
          tip: "Essencial para simular cenários de carga com dezenas de registros consistentes."
        }
      ]
    },
    {
      title: "Utilidades & Design",
      icon: Zap,
      color: "text-orange-600 dark:text-orange-400",
      tools: [
        {
          t: "Quadro de Arquitetura (Canvas)",
          d: "Quadro branco infinito com tecnologia Excalidraw para rascunhos rápidos de arquitetura e UML.",
          tip: "Salva os diagramas no navegador com exportação para PNG e SVG."
        },
        {
          t: "JUnit Test Generator",
          d: "Gera scaffolding de testes unitários seguindo Clean Architecture, JUnit 5 e Mockito.",
          tip: "Gera automaticamente anotações @Mock, @InjectMocks e testes com assertivas."
        },
        {
          t: "Comparador de Texto (Diff) & Cron",
          d: "Visualizador de diferenças side-by-side e decifrador em linguagem natural de expressões Cron.",
          tip: "Ideal para investigar diferenças entre logs de produção e homologação."
        }
      ]
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
        actionUrl={meta.actionUrl}
        actionLabel={meta.actionLabel}
      />

      {/* 3 Columns by Tool Area */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {categories.map((cat, idx) => (
          <div key={idx} className="space-y-4">
            <div className="flex items-center gap-2 px-1">
              <cat.icon className={`h-4 w-4 ${cat.color}`} />
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">
                {cat.title}
              </h3>
            </div>

            <div className="space-y-4">
              {cat.tools.map((tool, i) => (
                <div 
                  key={i} 
                  className="p-6 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/70 dark:border-slate-800 shadow-sm hover:shadow-md transition-all space-y-3"
                >
                  <h4 className="text-xs font-black uppercase tracking-wide text-slate-900 dark:text-slate-100">
                    {tool.t}
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
                    {tool.d}
                  </p>
                  <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 text-[10px] font-bold text-slate-600 dark:text-slate-300">
                    <span className="text-primary font-black">Dica:</span> {tool.tip}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

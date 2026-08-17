'use client';

import React, { useState } from 'react';
import { useFirebase } from '@/firebase';
import { useUserContext } from '@/context/UserContext';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import { EliteSpinner } from '@/components/ui/EliteSpinner';
import { Button } from '@/components/ui/button';
import { ShieldAlert, ArrowLeft, Database, Check, SkipForward, X } from 'lucide-react';
import { PromptItem } from '../types';

// Visibilidade 'role' e 'squad' existe no tipo, mas nenhuma consulta do Hub as
// carrega ainda — itens semeados com esses valores ficariam invisíveis para todos.
// Enquanto a feature não existir, o seed publica tudo como 'public'.
const INITIAL_PROMPTS: Partial<PromptItem>[] = [
  {
    title: "Refactor de Story Mapping",
    description: "Refina histórias de usuário transformando-as em épicos e tarefas técnicas com critérios de aceite BDD.",
    content: "Atue como um Especialista em Gestão de Produto Ágil. Analise a seguinte ideia de funcionalidade e desmembre-a em: 1. Épico principal, 2. User Stories (Persona + Necessidade + Valor), 3. Critérios de aceite em formato Gherkin (Dado/Quando/Então). Contexto: [DESCREVA SUA IDEIA AQUI]",
    type: 'prompt',
    visibility: 'public',
    authorName: "Mestre Ágil",
    authorRole: "Scrum Master",
    authorSquad: "Squad de Elite",
    tags: ["ProductManagement", "BDD", "Agile"],
    useCount: 124,
    forkCount: 45
  },
  {
    title: "Unit Test Master (TS/Jest)",
    description: "Gera suítes de teste completas cobrindo caminhos felizes e exceções para funções TypeScript.",
    content: "Você é um Engenheiro de Software Sênior. Gere uma suíte de testes unitários para a seguinte função TypeScript usando Jest. Garanta 100% de cobertura de branches, inclua mocks para dependências externas e utilize o padrão AAA (Arrange, Act, Assert). Código: [COLE SEU CÓDIGO AQUI]",
    type: 'prompt',
    visibility: 'public',
    authorName: "Wanderson",
    authorRole: "Engenheiro",
    authorSquad: "Arquitetura",
    tags: ["TypeScript", "Testing", "Jest", "CleanCode"],
    useCount: 312,
    forkCount: 89
  },
  {
    title: "Resumo de Daily para PO",
    description: "Resume os impedimentos e o progresso da daily de forma executiva para o Product Owner.",
    content: "Analise os seguintes logs de status da daily e gere um resumo executivo focado em: 1. Principais impedimentos detectados, 2. Riscos na data da entrega da sprint, 3. Destaques técnicos. Mantenha o tom profissional e direto. Dados: [LOGS DA DAILY]",
    type: 'prompt',
    visibility: 'public',
    authorName: "Bot Agile",
    authorRole: "Scrum Master",
    authorSquad: "Squad de Elite",
    tags: ["Daily", "Stakeholders", "Report"],
    useCount: 56,
    forkCount: 12
  },
  {
    title: "Gem: Diagnóstico de Squad",
    description: "Link direto para o modelo configurado no Gemini focado em métricas de produtividade.",
    content: "https://gemini.google.com/gems/diagnostico-squad",
    type: 'gem',
    gemLink: "https://gemini.google.com/gems/diagnostico-squad",
    visibility: 'public',
    authorName: "Engenharia",
    authorRole: "Engenheiro",
    authorSquad: "Plataforma",
    tags: ["Gems", "GoogleGemini", "Métricas"],
    useCount: 204,
    forkCount: 0
  }
];

type SeedResult = { title: string; outcome: 'created' | 'skipped' | 'failed'; detail?: string };

const seedIdFor = (title?: string) =>
  `seed_${title?.toLowerCase()
    .replace(/\//g, '_')
    .replace(/[^a-z0-9]/g, '_')
    .replace(/__+/g, '_')}`;

export default function SeedPromptsPage() {
  const { firestore, user, isUserLoading } = useFirebase();
  const { userProfile } = useUserContext();
  const router = useRouter();

  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<SeedResult[] | null>(null);

  const isAdmin = userProfile?.role === 'admin';

  async function runSeed() {
    if (!firestore || !user || !isAdmin) return;

    setIsRunning(true);
    const collected: SeedResult[] = [];

    for (const prompt of INITIAL_PROMPTS) {
      const id = seedIdFor(prompt.title);
      const ref = doc(firestore, 'prompt_hub', id);

      try {
        // Não sobrescreve item existente: o seed é para popular biblioteca vazia,
        // não para reverter edições feitas depois.
        const snap = await getDoc(ref);
        if (snap.exists()) {
          collected.push({ title: prompt.title!, outcome: 'skipped', detail: 'já existe' });
          continue;
        }

        await setDoc(ref, {
          ...prompt,
          id,
          authorId: user.uid,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
        collected.push({ title: prompt.title!, outcome: 'created' });
      } catch (err: any) {
        console.error(`Falha ao semear "${prompt.title}":`, err);
        collected.push({ title: prompt.title!, outcome: 'failed', detail: err?.code || 'erro desconhecido' });
      }
    }

    setResults(collected);
    setIsRunning(false);
  }

  if (isUserLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-slate-950">
        <EliteSpinner size="lg" variant="indigo" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center gap-6 bg-slate-950 px-6 text-center">
        <ShieldAlert className="h-16 w-16 text-rose-500" />
        <p className="max-w-md text-lg font-bold text-white">
          Área restrita. A carga de dados iniciais da biblioteca é exclusiva de administradores.
        </p>
        <Button
          onClick={() => router.push('/prompt-hub')}
          className="h-12 rounded-xl bg-slate-800 px-8 font-black uppercase tracking-widest text-white hover:bg-slate-700"
        >
          <ArrowLeft className="mr-2 h-4 w-4" /> Voltar ao Hub
        </Button>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen w-full flex-col items-center justify-center gap-8 bg-slate-950 px-6 py-16 text-white">
      <div className="max-w-xl space-y-3 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white/5 text-cyan-400">
          <Database className="h-6 w-6" />
        </div>
        <h2 className="text-3xl font-black uppercase italic tracking-tighter">Carga de Dados Iniciais</h2>
        <p className="text-xs font-bold uppercase tracking-widest text-slate-500">
          Grava {INITIAL_PROMPTS.length} modelos públicos de exemplo em <span className="text-slate-300">prompt_hub</span>
        </p>
        <p className="text-[11px] font-medium leading-relaxed text-slate-400">
          Esta operação escreve direto no banco de produção. Itens já existentes são preservados —
          nada é sobrescrito. Os modelos ficarão registrados com a sua conta como autora.
        </p>
      </div>

      {results && (
        <div className="w-full max-w-md space-y-2">
          {results.map(result => (
            <div
              key={result.title}
              className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3"
            >
              {result.outcome === 'created' && <Check className="h-4 w-4 shrink-0 text-emerald-400" />}
              {result.outcome === 'skipped' && <SkipForward className="h-4 w-4 shrink-0 text-slate-500" />}
              {result.outcome === 'failed' && <X className="h-4 w-4 shrink-0 text-rose-400" />}
              <span className="flex-1 truncate text-xs font-bold">{result.title}</span>
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                {result.detail || 'criado'}
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-col items-center gap-4 sm:flex-row">
        <Button
          onClick={runSeed}
          disabled={isRunning}
          className="h-14 rounded-2xl bg-white px-10 font-black uppercase tracking-widest text-slate-900 hover:bg-slate-100 disabled:opacity-50"
        >
          {isRunning ? 'Gravando...' : results ? 'Executar Novamente' : 'Executar Carga'}
        </Button>
        <Button
          variant="ghost"
          onClick={() => router.push('/prompt-hub')}
          className="font-black uppercase tracking-widest text-white/40 hover:text-white"
        >
          <ArrowLeft className="mr-2 h-4 w-4" /> Voltar ao Hub
        </Button>
      </div>
    </div>
  );
}

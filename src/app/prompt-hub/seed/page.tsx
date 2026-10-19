'use client';

import React, { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useUserContext } from '@/context/UserContext';
import { useRouter } from 'next/navigation';
import { EmptyState, LoadingSkeleton, PageHeader, PageShell } from '@/components/page';
import { ModalButton } from '@/components/room-kit';
import { ShieldAlert, ArrowLeft, Check, SkipForward, X } from 'lucide-react';
import { PromptItem } from '../types';
import { promptApi } from '../api';

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
    authorName: "Plataforma",
    authorRole: "Especialista",
    authorSquad: "Plataforma",
    tags: ["Gems", "GoogleGemini", "Métricas"],
    useCount: 204,
    forkCount: 0
  }
];

type SeedResult = { title: string; outcome: 'created' | 'skipped' | 'failed'; detail?: string };

export default function SeedPromptsPage() {
  const { session, isLoading: isUserLoading } = useAuth();
  const { userProfile, isInitializing } = useUserContext();
  const router = useRouter();

  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<SeedResult[] | null>(null);

  const isAdmin = userProfile?.role?.toLowerCase() === 'admin';

  async function runSeed() {
    if (!session || !isAdmin) return;

    setIsRunning(true);
    const collected: SeedResult[] = [];

    try {
      // Não sobrescreve item existente: o seed é para popular biblioteca vazia,
      // não para reverter edições feitas depois. Sem ID determinístico como no
      // Firestore (o Postgres gera UUID no servidor), a checagem de duplicidade
      // agora é por título entre os itens públicos já cadastrados.
      const existing = await promptApi.listPrompts(undefined, undefined, 0, 200);
      const existingTitles = new Set(existing.content.map(p => p.title));

      for (const prompt of INITIAL_PROMPTS) {
        if (existingTitles.has(prompt.title!)) {
          collected.push({ title: prompt.title!, outcome: 'skipped', detail: 'já existe' });
          continue;
        }

        try {
          await promptApi.createPrompt({ ...prompt, authorId: session.id });
          collected.push({ title: prompt.title!, outcome: 'created' });
        } catch (err: any) {
          console.error(`Falha ao semear "${prompt.title}":`, err);
          collected.push({ title: prompt.title!, outcome: 'failed', detail: err?.message || 'erro desconhecido' });
        }
      }
    } catch (err: any) {
      console.error('Falha ao verificar itens existentes antes do seed:', err);
      collected.push({ title: 'Verificação de duplicidade', outcome: 'failed', detail: err?.message || 'erro desconhecido' });
    }

    setResults(collected);
    setIsRunning(false);
  }

  if (isUserLoading || isInitializing) {
    return (
      <PageShell documentTitle="Carga de dados iniciais" width="narrow">
        <LoadingSkeleton variant="page" label="Verificando permissão" />
      </PageShell>
    );
  }

  if (!isAdmin) {
    return (
      <PageShell documentTitle="Acesso restrito" width="narrow">
        <EmptyState
          icon={ShieldAlert}
          title="Acesso restrito a administradores"
          description="A carga de dados iniciais da biblioteca de IA só pode ser executada por quem tem perfil de administrador. Se você precisa dela, peça a um administrador do portal."
          actions={
            <ModalButton variant="primary" onClick={() => router.push('/prompt-hub')}>
              <ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" /> Voltar à biblioteca
            </ModalButton>
          }
        />
      </PageShell>
    );
  }

  return (
    <PageShell documentTitle="Carga de dados iniciais" width="narrow">
      <PageHeader
        title="Carga de dados iniciais"
        module="prompt-hub"
        breadcrumb={[{ label: 'Biblioteca de IA', href: '/prompt-hub' }, { label: 'Carga de dados iniciais' }]}
        subtitle={`Grava ${INITIAL_PROMPTS.length} modelos públicos de exemplo na biblioteca (prompt_hub).`}
      />
      <p className="max-w-xl text-sm leading-relaxed text-muted-foreground">
        Esta operação escreve direto no banco de produção. Itens já existentes são preservados e
        nada é sobrescrito. Os modelos ficarão registrados com a sua conta como autora.
      </p>

      {results && (
        <ul className="w-full max-w-md space-y-2" aria-label="Resultado da carga">
          {results.map(result => (
            <li
              key={result.title}
              className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3"
            >
              {result.outcome === 'created' && <Check className="h-4 w-4 shrink-0 text-emerald-700 dark:text-emerald-300" aria-hidden="true" />}
              {result.outcome === 'skipped' && <SkipForward className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />}
              {result.outcome === 'failed' && <X className="h-4 w-4 shrink-0 text-red-700 dark:text-red-300" aria-hidden="true" />}
              <span className="flex-1 truncate text-sm font-semibold">{result.title}</span>
              <span className="text-xs font-medium text-muted-foreground">
                {result.detail || 'criado'}
              </span>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center">
        <ModalButton variant="primary" onClick={runSeed} disabled={isRunning} className="disabled:opacity-50">
          {isRunning ? 'Gravando...' : results ? 'Executar novamente' : 'Executar carga'}
        </ModalButton>
        <ModalButton variant="ghost" onClick={() => router.push('/prompt-hub')}>
          <ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" /> Voltar à biblioteca
        </ModalButton>
      </div>
    </PageShell>
  );
}

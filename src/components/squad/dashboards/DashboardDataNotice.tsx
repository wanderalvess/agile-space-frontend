"use client";

import Link from "next/link";
import { AlertTriangle, DatabaseZap, Users } from "lucide-react";
import { WidgetCard } from "@/components/ui/WidgetCard";

interface DashboardDataNoticeProps {
  hasSquad: boolean;
  loading: boolean;
  error: string | null;
  /** true quando já há alguma issue ou rollup da squad para mostrar */
  hasData: boolean;
}

/**
 * Diz, em palavras, por que um painel está vazio e qual é o próximo passo — em vez de zeros que parecem dado real.
 * Não renderiza nada quando há dados (ou ainda está carregando pela primeira vez).
 */
export function DashboardDataNotice({ hasSquad, loading, error, hasData }: DashboardDataNoticeProps) {
  if (!hasSquad) {
    return (
      <div role="status" className="flex items-start gap-3 rounded-2xl border border-amber-500/40 bg-amber-500/5 p-4 text-sm">
        <Users className="h-5 w-5 shrink-0 text-amber-500" aria-hidden="true" />
        <p className="text-foreground">
          Você ainda não está em uma squad, então não há números para mostrar. Escolha a sua equipe em{" "}
          <Link href="/onboarding" className="font-semibold text-primary hover:underline">Primeiros passos</Link>.
        </p>
      </div>
    );
  }
  if (loading) return null;
  if (error) {
    return (
      <div role="alert" className="flex items-start gap-3 rounded-2xl border border-rose-500/40 bg-rose-500/5 p-4 text-sm">
        <AlertTriangle className="h-5 w-5 shrink-0 text-rose-500" aria-hidden="true" />
        <p className="text-foreground">Não foi possível carregar os dados desta squad agora. {error}</p>
      </div>
    );
  }
  if (!hasData) {
    return (
      <div role="status" className="flex items-start gap-3 rounded-2xl border border-blue-500/40 bg-blue-500/5 p-4 text-sm">
        <DatabaseZap className="h-5 w-5 shrink-0 text-blue-500" aria-hidden="true" />
        <p className="text-foreground">
          Sem dados desta squad ainda. Sincronize a sprint com o Jira no{" "}
          <Link href="/squad" className="font-semibold text-primary hover:underline">Squad Hub</Link> e os números aparecem aqui.
        </p>
      </div>
    );
  }
  return null;
}

/** Cartão no lugar de um gráfico quando não há dado: diz que não há, em vez de desenhar zero. */
export function NoDataWidget({ title, message = "Sem dados desta squad ainda." }: { title: string; message?: string }) {
  return (
    <WidgetCard title={title}>
      <p className="py-8 text-center text-sm text-muted-foreground">{message}</p>
    </WidgetCard>
  );
}

"use client";

import React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useUser } from "@/context/UserContext";
import {
  getAllowedDashboardTabs,
  canUserAccessDashboard,
  getDashboardRouteForRole,
  isUserLeadershipOrAdmin,
} from "@/lib/dashboard-roles";
import { Code2, ShieldAlert, Lock, ArrowLeft, Compass } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function DashboardAccessDenied() {
  const router = useRouter();
  const { userProfile } = useUser();
  const fallbackRoute = getDashboardRouteForRole(userProfile?.role);
  return (
    <div className="flex flex-col items-center justify-center p-8 text-center rounded-2xl border border-destructive/30 bg-destructive/5 my-6 gap-4">
      <div className="p-3 rounded-full bg-destructive/10 text-destructive">
        <ShieldAlert className="h-8 w-8" />
      </div>
      <div>
        <h3 className="text-lg font-bold text-foreground">Este painel é de outro papel</h3>
        <p className="text-sm text-muted-foreground mt-1 max-w-md">
          Seu papel atual (<span className="font-semibold text-foreground">{userProfile?.role || "Membro"}</span>) não tem acesso a esta visão. Você pode abrir o painel do seu papel ou voltar ao Squad Hub.
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Button onClick={() => router.replace("/squad")} variant="outline" className="h-11 rounded-xl px-4 text-sm font-semibold gap-2">
          <Compass className="h-4 w-4 text-primary" />
          Voltar ao Squad Hub
        </Button>
        <Button onClick={() => router.replace(fallbackRoute)} className="h-11 rounded-xl px-4 text-sm font-bold gap-2">
          <ArrowLeft className="h-4 w-4" />
          Abrir o painel do meu papel
        </Button>
      </div>
    </div>
  );
}

export function DashboardNavTabs() {
  const pathname = usePathname();
  const router = useRouter();
  const { userProfile, isLeadership } = useUser();

  const isSuperUser = isLeadership || isUserLeadershipOrAdmin(userProfile?.role);
  const allowedTabs = getAllowedDashboardTabs(userProfile?.role, isSuperUser);
  const hasAccess = canUserAccessDashboard(userProfile?.role, pathname, isSuperUser);

  // Sem acesso, o layout já mostra o aviso e não monta a página; aqui só evita desenhar as abas.
  if (!hasAccess) return null;

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-border/80 pb-3">
      {/* Botão de retorno direto ao Squad Hub */}
      <Link
        href="/squad"
        title="Voltar à Visão geral do Squad Hub"
        className="rounded-xl px-4 py-2 text-sm font-semibold transition-all flex items-center gap-1.5 bg-muted/80 text-foreground hover:bg-muted border border-border shadow-xs group mr-1"
      >
        <ArrowLeft className="h-3.5 w-3.5 text-primary group-hover:-translate-x-0.5 transition-transform" />
        Squad Hub
      </Link>

      <div className="w-px h-6 bg-border mx-1 hidden sm:block" />

      {/* Abas de Dashboards autorizadas para o cargo */}
      {allowedTabs.map((tab) => {
        const isActive = pathname === tab.href;
        const isJql = tab.id === "custom";

        return (
          <Link
            key={tab.id}
            href={tab.href}
            title={tab.description}
            className={cn(
              "rounded-xl px-4 py-2 text-sm font-semibold transition-all flex items-center gap-1.5",
              isActive
                ? "bg-primary text-primary-foreground shadow-md shadow-primary/20 scale-[1.02]"
                : "bg-card border border-border/80 text-muted-foreground hover:text-foreground hover:bg-accent/60"
            )}
          >
            {isJql && <Code2 className="h-3.5 w-3.5" />}
            {tab.label}
          </Link>
        );
      })}

      {isSuperUser && (
        <span className="ml-auto hidden md:inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-full bg-primary/10 text-primary border border-primary/20">
          Visão de liderança
        </span>
      )}
    </div>
  );
}

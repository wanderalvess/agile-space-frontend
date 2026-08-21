"use client";

import React from "react";
import Link from "next/link";
import { RoomHeader } from "@/components/layout/RoomHeader";
import { LayoutDashboard, ArrowLeft } from "lucide-react";

export default function SquadDashboardsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen w-full bg-background text-foreground flex flex-col font-sans">
      {/* Cabeçalho padrão unificado do Espaço Ágil respeitando o tema ativo */}
      <RoomHeader
        title="Painel de Gestão da Squad"
        toolIcon={<LayoutDashboard className="h-4 w-4 text-primary" />}
        toolColorClass="text-primary"
        className="bg-card/80 backdrop-blur-md border-b border-border text-foreground"
        actions={
          <Link
            href="/squad"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-muted-foreground hover:text-foreground bg-muted/60 hover:bg-muted rounded-xl border border-border transition-all"
            title="Voltar ao Squad Hub"
          >
            <ArrowLeft className="h-3.5 w-3.5 text-primary" />
            <span className="hidden sm:inline">Voltar ao</span> Squad Hub
          </Link>
        }
      />

      {/* Conteúdo Principal */}
      <main className="flex-1 w-full max-w-[1440px] mx-auto p-4 md:p-8">
        {children}
      </main>
    </div>
  );
}

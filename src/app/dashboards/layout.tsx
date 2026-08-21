"use client";

import React from "react";
import { RoomHeader } from "@/components/layout/RoomHeader";
import { LayoutDashboard } from "lucide-react";

export default function DashboardsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen w-full bg-[#0B0E14] text-slate-100 flex flex-col font-sans">
      {/* Cabeçalho padrão unificado do Espaço Ágil */}
      <RoomHeader
        title="Gestão de Projetos Ágeis"
        toolIcon={<LayoutDashboard className="h-4 w-4 text-orange-500" />}
        toolColorClass="text-orange-500"
      />

      {/* Conteúdo Principal */}
      <main className="flex-1 w-full max-w-[1440px] mx-auto p-4 md:p-8">
        {children}
      </main>
    </div>
  );
}

"use client";

import React from "react";
import { DashboardNavTabs } from "@/components/squad/dashboards/DashboardNavTabs";
import { CustomJqlPanelsSection } from "@/components/squad/dashboards/CustomJqlPanelsSection";

export default function CustomJqlDashboardsPage() {
  return (
    <div className="flex flex-col gap-6">
      {/* Abas com controle de acesso por Cargo */}
      <DashboardNavTabs />

      {/* Seção Principal de Painéis Customizados */}
      <CustomJqlPanelsSection />
    </div>
  );
}

"use client";

import React, { useState, useEffect } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Layers, ShieldCheck } from "lucide-react";

export type EstimationUnit = "SP" | "HOURS" | "TSHIRT" | "COUNT";

export interface FilterOption {
  label: string;
  value: string;
}

export interface FilterProps {
  label: string;
  placeholder: string;
  options: FilterOption[];
  icon?: React.ReactNode;
  value?: string;
  onChange?: (val: string) => void;
}

interface DashboardFiltersProps {
  filters: FilterProps[];
}

export function useProjectEstimationUnit(): { unit: EstimationUnit; unitLabel: string } {
  const [unit, setUnit] = useState<EstimationUnit>("SP");

  useEffect(() => {
    try {
      const saved = localStorage.getItem("agileSpace_projectEstimationUnit");
      if (saved && ["SP", "HOURS", "TSHIRT", "COUNT"].includes(saved)) {
        setUnit(saved as EstimationUnit);
      }
    } catch {}
  }, []);

  const getUnitLabel = (u: EstimationUnit) => {
    switch (u) {
      case "HOURS": return "Horas (h)";
      case "TSHIRT": return "T-Shirt (P/M/G)";
      case "COUNT": return "Contagem (Throughput)";
      default: return "Story Points (SP)";
    }
  };

  return { unit, unitLabel: getUnitLabel(unit) };
}

export function DashboardFilters({ filters }: DashboardFiltersProps) {
  const { unit, unitLabel } = useProjectEstimationUnit();

  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* Indicador Fixo da Configuração Oficial do Projeto (Definido no Admin) */}
      <div className="flex flex-col gap-1">
        <label className="text-[10px] font-bold text-primary uppercase tracking-wider flex items-center gap-1">
          <ShieldCheck className="h-3 w-3 text-primary" />
          Métrica do Projeto
        </label>
        <div className="h-9 px-3.5 bg-primary/10 border border-primary/25 text-primary text-xs font-bold rounded-xl flex items-center gap-2 shadow-inner">
          <Layers className="h-3.5 w-3.5 text-primary" />
          <span>{unitLabel}</span>
        </div>
      </div>

      {/* Outros Filtros Dinâmicos (Sprint, Projeto, Período) */}
      {filters.map((filter, index) => (
        <div key={index} className="flex flex-col gap-1">
          <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
            {filter.label}
          </label>
          <Select
            defaultValue={filter.options[0]?.value}
            value={filter.value}
            onValueChange={filter.onChange}
          >
            <SelectTrigger className="w-[170px] h-9 bg-card border-border text-foreground text-xs font-medium focus:ring-1 focus:ring-primary focus:border-primary rounded-xl shadow-sm">
              <div className="flex items-center gap-2 truncate">
                {filter.icon && <span className="text-muted-foreground">{filter.icon}</span>}
                <SelectValue placeholder={filter.placeholder} />
              </div>
            </SelectTrigger>
            <SelectContent className="bg-card border-border text-card-foreground text-xs rounded-xl shadow-xl">
              {filter.options.map((opt) => (
                <SelectItem
                  key={opt.value}
                  value={opt.value}
                  className="focus:bg-muted focus:text-foreground cursor-pointer py-2"
                >
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ))}
    </div>
  );
}

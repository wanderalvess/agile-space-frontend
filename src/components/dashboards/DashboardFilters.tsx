import React from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface FilterOption {
  label: string;
  value: string;
}

interface FilterProps {
  label: string;
  placeholder: string;
  options: FilterOption[];
  icon?: React.ReactNode;
}

interface DashboardFiltersProps {
  filters: FilterProps[];
}

export function DashboardFilters({ filters }: DashboardFiltersProps) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      {filters.map((filter, index) => (
        <div key={index} className="flex flex-col gap-1">
          <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            {filter.label}
          </label>
          <Select defaultValue={filter.options[0]?.value}>
            <SelectTrigger className="w-[170px] h-9 bg-[#1D2332] border-slate-700/80 text-slate-200 text-xs font-medium focus:ring-1 focus:ring-orange-500 focus:border-orange-500 rounded-xl shadow-inner">
              <div className="flex items-center gap-2 truncate">
                {filter.icon && <span className="text-slate-400">{filter.icon}</span>}
                <SelectValue placeholder={filter.placeholder} />
              </div>
            </SelectTrigger>
            <SelectContent className="bg-[#1D2332] border-slate-700 text-slate-200 text-xs rounded-xl shadow-xl">
              {filter.options.map((opt) => (
                <SelectItem key={opt.value} value={opt.value} className="focus:bg-slate-800 focus:text-white cursor-pointer py-2">
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

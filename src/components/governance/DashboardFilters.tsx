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
    <div className="flex flex-wrap items-center gap-4">
      {filters.map((filter, index) => (
        <div key={index} className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-gray-400">
            {filter.label}
          </label>
          <Select defaultValue={filter.options[0]?.value}>
            <SelectTrigger className="w-[180px] bg-[#171A21] border-gray-700 text-gray-200 focus:ring-orange-500 focus:border-orange-500">
              <div className="flex items-center gap-2">
                {filter.icon && <span className="text-gray-400">{filter.icon}</span>}
                <SelectValue placeholder={filter.placeholder} />
              </div>
            </SelectTrigger>
            <SelectContent className="bg-[#171A21] border-gray-700 text-gray-200">
              {filter.options.map((opt) => (
                <SelectItem key={opt.value} value={opt.value} className="focus:bg-[#2A2E39] focus:text-white cursor-pointer">
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

"use client"

import * as React from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { DayPicker } from "react-day-picker"

import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"

export type CalendarProps = React.ComponentProps<typeof DayPicker>

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-3", className)}
      classNames={{
        months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
        month: "space-y-4",
        caption: "flex justify-center pt-1 relative items-center mb-4",
        caption_label: "text-sm font-black uppercase tracking-widest italic",
        nav: "space-x-1 flex items-center",
        nav_button: cn(
          buttonVariants({ variant: "ghost" }),
          "h-7 w-7 bg-slate-100/50 p-0 hover:bg-slate-200 transition-colors rounded-full"
        ),
        nav_button_previous: "absolute left-1",
        nav_button_next: "absolute right-1",
        table: "w-full border-collapse",
        head_row: "flex justify-between w-full mb-2",
        head_cell:
          "text-slate-400 rounded-md w-9 font-black text-[10px] uppercase tracking-widest text-center",
        row: "flex w-full mt-2 justify-between",
        cell: "h-9 w-9 text-center text-sm p-0 relative focus-within:relative focus-within:z-20",
        day: cn(
          buttonVariants({ variant: "ghost" }),
          "h-9 w-9 p-0 font-bold rounded-xl aria-selected:opacity-100 hover:bg-indigo-50 hover:text-indigo-600 transition-all"
        ),
        day_range_end: "day-range-end",
        day_selected:
          "bg-indigo-600 text-white hover:bg-indigo-700 hover:text-white focus:bg-indigo-600 focus:text-white rounded-xl shadow-lg shadow-indigo-500/20",
        day_today: "bg-slate-100 text-slate-900 border border-slate-200",
        day_outside:
          "day-outside text-slate-300 opacity-50 aria-selected:bg-indigo-50/50 aria-selected:text-slate-400",
        day_disabled: "text-slate-300 opacity-50",
        day_range_middle:
          "aria-selected:bg-indigo-50 aria-selected:text-indigo-900",
        day_hidden: "invisible",
        ...classNames,
      }}
      components={{
        // react-day-picker v9 replaced IconLeft/IconRight with a single Chevron component
        Chevron: ({ className, orientation, ...props }: { className?: string; orientation?: 'left' | 'right' | 'up' | 'down'; [key: string]: any }) => {
          const Icon = orientation === 'left' ? ChevronLeft : ChevronRight;
          return <Icon className={cn("h-4 w-4", className)} {...props} />;
        },
      }}
      {...props}
    />
  )
}
Calendar.displayName = "Calendar"

export { Calendar }

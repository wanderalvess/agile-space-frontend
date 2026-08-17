'use client';

import React, { useState, useEffect } from 'react';
import { Timer, Cloud } from 'lucide-react';
import { ToolHubLayout } from '@/components/shared/ToolHubLayout';
import { useFirebase } from '@/firebase';
import { useDailyStore } from '@/store/useDailyStore';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

import dynamic from 'next/dynamic';

const FocusPlayer = dynamic(
  () => import('./components/FocusPlayer'),
  { ssr: false }
);

const DailyTimesheet = dynamic(
  () => import('./components/DailyTimesheet'),
  { ssr: false }
);

const DailyReport = dynamic(
  () => import('./components/DailyReport'),
  { ssr: false }
);

const PerformanceDashboard = dynamic(
  () => import('./components/PerformanceDashboard'),
  { ssr: false }
);

export default function DailyFlowPage() {
  const { firestore, user } = useFirebase();
  const { selectedDate, fetchWorklogs, fetchWeeklyWorklogs, fetchDailyReports } = useDailyStore();

  useEffect(() => {
    document.title = `Daily Command Center | Espaço Ágil`;
  }, []);

  // Fetch worklogs and reports whenever Firebase user or selectedDate changes
  useEffect(() => {
    if (firestore && user) {
      fetchWorklogs(firestore, user.uid, selectedDate);
      fetchWeeklyWorklogs(firestore, user.uid);
      fetchDailyReports(firestore, user.uid);
    }
  }, [firestore, user, selectedDate, fetchWorklogs, fetchWeeklyWorklogs, fetchDailyReports]);

  return (
    <Tabs defaultValue="registro" className="flex-1 flex flex-col overflow-hidden w-full">
      <ToolHubLayout
        title="Daily Command Center"
        description="Acompanhamento diário de progresso, timesheet automatizado e foco da squad."
        icon={<Timer className="h-5 w-5" />}
        themeColor="indigo"
        tips={[]}
        onlyChildren={true}
        badge={
          <div className="flex items-center gap-1.5 text-[8px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] leading-none ml-2 bg-slate-100 dark:bg-slate-900 px-2 py-1 rounded-md">
            <Cloud className="h-2.5 w-2.5 text-emerald-500 animate-pulse" />
            <span className="hidden sm:inline">Espaço Ágil</span>
          </div>
        }
        actions={
          <TabsList className="flex bg-slate-100/50 dark:bg-slate-800/40 p-0.5 rounded-lg border border-slate-200/50 dark:border-slate-800/30 h-8 mr-2 shrink-0">
            <TabsTrigger value="registro" className="text-[9px] font-black uppercase tracking-wider rounded-md h-7 px-3 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-950 shadow-xs">
              Registro Diário
            </TabsTrigger>
            <TabsTrigger value="dashboard" className="text-[9px] font-black uppercase tracking-wider rounded-md h-7 px-3 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-950 shadow-xs">
              Dashboard
            </TabsTrigger>
          </TabsList>
        }
      >
        <main className="flex-1 w-full p-4 md:p-5 overflow-y-auto md:overflow-hidden flex flex-col">
          {/* Tab 1: Registro Diário Grid */}
          <TabsContent value="registro" className="flex-1 min-h-0 m-0 outline-none data-[state=inactive]:hidden flex flex-col md:h-full">
            <div className="grid grid-cols-12 gap-4 flex-1 md:h-full">
              {/* Column 1: Focus Player (span-3) */}
              <div className="col-span-12 md:col-span-3 h-[520px] md:h-full min-h-0">
                <FocusPlayer />
              </div>

              {/* Column 2: Daily Timesheet (span-5) */}
              <div className="col-span-12 md:col-span-5 h-[520px] md:h-full min-h-0">
                <DailyTimesheet />
              </div>

              {/* Column 3: Daily Sync Report (span-4) */}
              <div className="col-span-12 md:col-span-4 h-[520px] md:h-full min-h-0">
                <DailyReport />
              </div>
            </div>
          </TabsContent>

          {/* Tab 2: Dashboard Placeholder */}
          <TabsContent value="dashboard" className="flex-1 min-h-0 m-0 outline-none data-[state=inactive]:hidden flex flex-col md:h-full">
            <PerformanceDashboard />
          </TabsContent>
        </main>
      </ToolHubLayout>
    </Tabs>
  );
}

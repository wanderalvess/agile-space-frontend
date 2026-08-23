'use client';

import React, { useState } from 'react';
import {
  TestTube,
  Database,
  FileCode2,
  Flame,
  GitCompare,
  Bot,
  Layers,
  ShieldCheck
} from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ToolHubLayout } from '@/components/shared/ToolHubLayout';

import { TestDataGenerator } from './components/TestDataGenerator';
import { ZephyrExplorer } from './components/ZephyrExplorer';
import { BddBugStudio } from './components/BddBugStudio';
import { BoundaryFuzzLab } from './components/BoundaryFuzzLab';
import { ApiDiffAssistant } from './components/ApiDiffAssistant';
import { AutomationCodeGenerator } from './components/AutomationCodeGenerator';
import { MockStudioIntegration } from './components/MockStudioIntegration';

const TAB_TRIGGER_CLASS = "text-[9.5px] font-black uppercase tracking-wider rounded-lg h-6 px-3 gap-1.5 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-900 shadow-xs";

export default function QaHubPage() {
  const [activeTab, setActiveTab] = useState('data');

  return (
    <ToolHubLayout
      title="Central de Qualidade & Testes"
      description="Integração com Zephyr, gerador de massa de dados, estúdio BDD, gerador de automação (Cypress/Playwright), simulador de erros e mocks de API."
      icon={<ShieldCheck className="h-5 w-5" />}
      themeColor="primary"
      tips={[]}
      onlyChildren={true}
      badge={
        <div className="flex items-center gap-1.5 text-[8px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] leading-none ml-2 bg-slate-100 dark:bg-slate-900 px-2 py-1 rounded-md">
          <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
          <span>QA HUB</span>
        </div>
      }
      actions={
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-auto">
          <TabsList className="bg-slate-100/80 dark:bg-slate-800/60 p-1 rounded-xl h-8 gap-1 hidden lg:inline-flex border border-slate-200/50 dark:border-slate-800/50">
            <TabsTrigger value="data" className={TAB_TRIGGER_CLASS}>
              <Database className="h-3.5 w-3.5" /> Massa de Dados
            </TabsTrigger>
            <TabsTrigger value="zephyr" className={TAB_TRIGGER_CLASS}>
              <TestTube className="h-3.5 w-3.5" /> Zephyr
            </TabsTrigger>
            <TabsTrigger value="bdd" className={TAB_TRIGGER_CLASS}>
              <FileCode2 className="h-3.5 w-3.5" /> BDD & Bugs
            </TabsTrigger>
            <TabsTrigger value="automation" className={TAB_TRIGGER_CLASS}>
              <Bot className="h-3.5 w-3.5" /> Automação
            </TabsTrigger>
            <TabsTrigger value="mocks" className={TAB_TRIGGER_CLASS}>
              <Layers className="h-3.5 w-3.5" /> Mocks
            </TabsTrigger>
            <TabsTrigger value="fuzz" className={TAB_TRIGGER_CLASS}>
              <Flame className="h-3.5 w-3.5" /> Fuzzing
            </TabsTrigger>
            <TabsTrigger value="api" className={TAB_TRIGGER_CLASS}>
              <GitCompare className="h-3.5 w-3.5" /> API & Diff
            </TabsTrigger>
          </TabsList>
        </Tabs>
      }
    >
      <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar px-4 md:px-8 pb-8 pt-6">
        {/* SELETOR DE ABAS PARA TELAS PEQUENAS (a barra do header some abaixo de lg) */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full mb-6 lg:hidden">
          <TabsList className="flex items-center justify-start w-max min-w-full overflow-x-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-1.5 rounded-2xl shadow-sm gap-1 scrollbar-thin">
            <TabsTrigger value="data" className="px-4 py-2.5 rounded-xl font-bold text-xs gap-2 data-[state=active]:bg-primary data-[state=active]:text-white transition-all">
              <Database className="h-4 w-4" /> Massa de Dados
            </TabsTrigger>
            <TabsTrigger value="zephyr" className="px-4 py-2.5 rounded-xl font-bold text-xs gap-2 data-[state=active]:bg-primary data-[state=active]:text-white transition-all">
              <TestTube className="h-4 w-4" /> Zephyr
            </TabsTrigger>
            <TabsTrigger value="bdd" className="px-4 py-2.5 rounded-xl font-bold text-xs gap-2 data-[state=active]:bg-primary data-[state=active]:text-white transition-all">
              <FileCode2 className="h-4 w-4" /> BDD & Bugs
            </TabsTrigger>
            <TabsTrigger value="automation" className="px-4 py-2.5 rounded-xl font-bold text-xs gap-2 data-[state=active]:bg-primary data-[state=active]:text-white transition-all">
              <Bot className="h-4 w-4" /> Automação
            </TabsTrigger>
            <TabsTrigger value="mocks" className="px-4 py-2.5 rounded-xl font-bold text-xs gap-2 data-[state=active]:bg-primary data-[state=active]:text-white transition-all">
              <Layers className="h-4 w-4" /> Mocks
            </TabsTrigger>
            <TabsTrigger value="fuzz" className="px-4 py-2.5 rounded-xl font-bold text-xs gap-2 data-[state=active]:bg-primary data-[state=active]:text-white transition-all">
              <Flame className="h-4 w-4" /> Fuzzing
            </TabsTrigger>
            <TabsTrigger value="api" className="px-4 py-2.5 rounded-xl font-bold text-xs gap-2 data-[state=active]:bg-primary data-[state=active]:text-white transition-all">
              <GitCompare className="h-4 w-4" /> API & Diff
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {activeTab === 'data' && <TestDataGenerator />}
        {activeTab === 'zephyr' && <ZephyrExplorer />}
        {activeTab === 'bdd' && <BddBugStudio />}
        {activeTab === 'automation' && <AutomationCodeGenerator />}
        {activeTab === 'mocks' && <MockStudioIntegration />}
        {activeTab === 'fuzz' && <BoundaryFuzzLab />}
        {activeTab === 'api' && <ApiDiffAssistant />}
      </div>
    </ToolHubLayout>
  );
}

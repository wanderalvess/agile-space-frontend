'use client';

import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  TestTube, 
  Database, 
  FileCode2, 
  Flame, 
  GitCompare, 
  FileSpreadsheet, 
  Bot,
  Layers,
  ShieldCheck
} from 'lucide-react';
import Link from 'next/link';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

import { TestDataGenerator } from './components/TestDataGenerator';
import { ZephyrExplorer } from './components/ZephyrExplorer';
import { BddBugStudio } from './components/BddBugStudio';
import { BoundaryFuzzLab } from './components/BoundaryFuzzLab';
import { ApiDiffAssistant } from './components/ApiDiffAssistant';
import { AutomationCodeGenerator } from './components/AutomationCodeGenerator';
import { MockStudioIntegration } from './components/MockStudioIntegration';

export default function QaHubPage() {
  const [activeTab, setActiveTab] = useState('data');

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.title = 'Central de Qualidade & Testes (QA Hub) | Espaço Ágil';
    }
  }, []);

  return (
    <div className="flex flex-col w-full min-h-dvh bg-slate-50/50 dark:bg-slate-950/50 font-sans selection:bg-primary/30">
      
      {/* BANNER PRINCIPAL DO MÓDULO DE QA */}
      <div className="w-full bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 text-white border-b border-slate-800 shadow-md">
        <div className="w-full px-4 sm:px-6 lg:px-8 py-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="bg-orange-500/10 text-primary border-orange-500/30 text-[10px] font-black uppercase tracking-widest px-3 py-0.5 rounded-full">
                Módulo QA
              </Badge>
              <span className="text-xs text-slate-400 font-semibold">• Espaço Ágil Engineering</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black uppercase tracking-tight italic flex items-center gap-3">
              Central de Qualidade & Testes <ShieldCheck className="h-7 w-7 text-primary" />
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 max-w-3xl font-medium leading-relaxed">
              O espaço de trabalho definitivo para engenheiros de QA. Integração com Zephyr, gerador de massa de dados, estúdio BDD, gerador de automação (Cypress/Playwright), simulador de erros e mocks de API.
            </p>
          </div>

          <Link href="/devtools/xlsx-to-csv">
            <Button variant="outline" className="h-10 text-xs font-black uppercase tracking-wider bg-white/5 border-slate-700 hover:bg-white/10 text-white gap-2 rounded-xl shrink-0">
              <FileSpreadsheet className="h-4 w-4 text-emerald-400" />
              Conversor XLSX para CSV
            </Button>
          </Link>
        </div>
      </div>

      {/* ÁREA DE CONTEÚDO EM TELA TODA */}
      <main className="flex-1 w-full px-4 sm:px-6 lg:px-8 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full space-y-6">
          
          {/* BARRA SUPERIOR DE NAVEGAÇÃO ENTRE FERRAMENTAS */}
          <div className="overflow-x-auto pb-1 scrollbar-thin">
            <TabsList className="flex items-center justify-start w-max min-w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-1.5 rounded-2xl shadow-sm gap-1">
              
              <TabsTrigger 
                value="data" 
                className="px-4 py-2.5 rounded-xl font-bold text-xs gap-2.5 data-[state=active]:bg-primary data-[state=active]:text-white transition-all"
              >
                <Database className="h-4 w-4" /> Massa de Dados
              </TabsTrigger>

              <TabsTrigger 
                value="zephyr" 
                className="px-4 py-2.5 rounded-xl font-bold text-xs gap-2.5 data-[state=active]:bg-blue-600 data-[state=active]:text-white transition-all"
              >
                <TestTube className="h-4 w-4" /> Zephyr & Relatórios
              </TabsTrigger>

              <TabsTrigger 
                value="bdd" 
                className="px-4 py-2.5 rounded-xl font-bold text-xs gap-2.5 data-[state=active]:bg-emerald-600 data-[state=active]:text-white transition-all"
              >
                <FileCode2 className="h-4 w-4" /> BDD & Bug Report
              </TabsTrigger>

              <TabsTrigger 
                value="automation" 
                className="px-4 py-2.5 rounded-xl font-bold text-xs gap-2.5 data-[state=active]:bg-emerald-700 data-[state=active]:text-white transition-all"
              >
                <Bot className="h-4 w-4 text-emerald-400" /> Código de Automação
              </TabsTrigger>

              <TabsTrigger 
                value="mocks" 
                className="px-4 py-2.5 rounded-xl font-bold text-xs gap-2.5 data-[state=active]:bg-purple-700 data-[state=active]:text-white transition-all"
              >
                <Layers className="h-4 w-4 text-purple-400" /> Estúdio de Mocks
              </TabsTrigger>

              <TabsTrigger 
                value="fuzz" 
                className="px-4 py-2.5 rounded-xl font-bold text-xs gap-2.5 data-[state=active]:bg-amber-600 data-[state=active]:text-white transition-all"
              >
                <Flame className="h-4 w-4" /> Testes de Fronteira / Fuzzing
              </TabsTrigger>

              <TabsTrigger 
                value="api" 
                className="px-4 py-2.5 rounded-xl font-bold text-xs gap-2.5 data-[state=active]:bg-purple-600 data-[state=active]:text-white transition-all"
              >
                <GitCompare className="h-4 w-4" /> Assistente API & Diff
              </TabsTrigger>

            </TabsList>
          </div>

          {/* CONTEÚDO DAS ABAS */}
          <TabsContent value="data" className="m-0 focus-visible:outline-none">
            <TestDataGenerator />
          </TabsContent>

          <TabsContent value="zephyr" className="m-0 focus-visible:outline-none">
            <ZephyrExplorer />
          </TabsContent>

          <TabsContent value="bdd" className="m-0 focus-visible:outline-none">
            <BddBugStudio />
          </TabsContent>

          <TabsContent value="automation" className="m-0 focus-visible:outline-none">
            <AutomationCodeGenerator />
          </TabsContent>

          <TabsContent value="mocks" className="m-0 focus-visible:outline-none">
            <MockStudioIntegration />
          </TabsContent>

          <TabsContent value="fuzz" className="m-0 focus-visible:outline-none">
            <BoundaryFuzzLab />
          </TabsContent>

          <TabsContent value="api" className="m-0 focus-visible:outline-none">
            <ApiDiffAssistant />
          </TabsContent>

        </Tabs>
      </main>

    </div>
  );
}

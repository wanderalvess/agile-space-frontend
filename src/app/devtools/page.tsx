'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  ArrowRightLeft,
  GitCompare,
  Network,
  ScanSearch,
  Scan,
  TestTube,
  Code2,
  Zap,
  FileJson,
  FileCode,
  Search,
  ExternalLink,
  ChevronRight,
  Database,
  Clock,
  Globe,
  FileText,
  Rocket,
  MapPin,
  Type,
  Calculator,
  CalendarDays,
  Hash,
  SpellCheck,
  Binary,
  Braces,
  ShieldCheck,
  ArrowLeft,
  LayoutGrid,
  Fingerprint,
  Link as LinkIcon,
  Key,
  Database as SqlIcon,
  FileSpreadsheet
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Logo } from '@/components/Logo';
import { FeedbackWidget } from '@/components/feedback-widget';
import { Footer } from '@/components/layout/Footer';

const TOOLS = [
  {
    title: 'Conversor Estrutural (Jolt)',
    description: 'Ferramenta estrutural para organizar e converter dados de arquivos complexos.',
    href: '/devtools/jolt',
    icon: ArrowRightLeft,
    category: 'Formatadores & Conversores',
    color: 'text-indigo-600',
    bg: 'bg-indigo-50',
    featured: true,
    iconSize: 'h-6 w-6'
  },
  {
    title: 'Mapeador Visual Jolt',
    description: 'Modelagem visual para transformações complexas via drag-and-drop.',
    href: '/jolt/visual',
    icon: GitCompare,
    category: 'Formatadores & Conversores',
    color: 'text-indigo-600',
    bg: 'bg-indigo-50'
  },
  {
    title: 'Quadro de Desenho e Fluxos',
    description: 'Tela interativa para esboçar fluxogramas, cronogramas e organogramas.',
    href: '/devtools/architecture',
    icon: Network,
    category: 'Design & Diagramas',
    color: 'text-emerald-600',
    bg: 'bg-emerald-50'
  },
  {
    title: 'Comparador de Textos e Arquivos',
    description: 'Compare dois textos lado a lado para encontrar diferenças ou alterações.',
    href: '/devtools/diff',
    icon: GitCompare,
    category: 'Utilidades Diárias',
    color: 'text-orange-600',
    bg: 'bg-orange-50'
  },
  {
    title: 'Decodificador de Mensagens Seguras',
    description: 'Extrai e lê mensagens e dados codificados em Base64 dentro de arquivos.',
    href: '/devtools/deep-decoder',
    icon: ScanSearch,
    category: 'Privacidade & Segurança',
    color: 'text-cyan-600',
    bg: 'bg-cyan-50'
  },
  {
    title: 'Gerador de Modelos de Dados',
    description: 'Converte arquivos de dados para diferentes formatos de linguagem de programação.',
    href: '/devtools/type-generator',
    icon: Scan,
    category: 'Geradores Auxiliares',
    color: 'text-rose-600',
    bg: 'bg-rose-50'
  },
  {
    title: 'Gerador de Modelos de Teste',
    description: 'Cria estruturas e cenários padronizados para verificação de rotinas.',
    href: '/devtools/junit-generator',
    icon: TestTube,
    category: 'Qualidade & Testes',
    color: 'text-rose-600',
    bg: 'bg-rose-50'
  },
  {
    title: 'Conversor de Planilhas (Excel/CSV)',
    description: 'Importa tarefas de teste do Jira ou converta arquivos Excel para planilhas simples CSV.',
    href: '/devtools/xlsx-to-csv',
    icon: FileSpreadsheet,
    category: 'Qualidade & Testes',
    color: 'text-rose-600',
    bg: 'bg-rose-50'
  },
  {
    title: 'Modelador de Conexões de Rede',
    description: 'Cria códigos de conexões e requisições para integração entre sistemas.',
    href: '/devtools/api-snippets',
    icon: Code2,
    category: 'Geradores Auxiliares',
    color: 'text-amber-600',
    bg: 'bg-amber-50'
  },
  {
    title: 'Codificador de Textos (Base64)',
    description: 'Codifica e decodifica textos para envio seguro e proteção de caracteres.',
    href: '/devtools/base64',
    icon: Zap,
    category: 'Utilidades Diárias',
    color: 'text-orange-600',
    bg: 'bg-orange-50'
  },
  {
    title: 'Formatador de Arquivos JSON',
    description: 'Organiza, alinha e valida a estrutura de dados de arquivos JSON.',
    href: '/devtools/json',
    icon: FileJson,
    category: 'Gestão de Dados',
    color: 'text-indigo-600',
    bg: 'bg-indigo-50'
  },
  {
    title: 'Formatador de Arquivos XML',
    description: 'Organiza, alinha e converte arquivos no formato estruturado XML.',
    href: '/devtools/xml',
    icon: FileCode,
    category: 'Gestão de Dados',
    color: 'text-slate-600',
    bg: 'bg-slate-50'
  },
  {
    title: 'Gerador de Dados Fictícios',
    description: 'Gera nomes, endereços e informações fictícias para simulações e testes.',
    href: '/devtools/mock-factory',
    icon: Database,
    category: 'Gestão de Dados',
    color: 'text-emerald-600',
    bg: 'bg-emerald-50'
  },
  {
    title: 'Validador de Regras de Arquivo',
    description: 'Verifica se um arquivo de dados atende aos requisitos e regras definidos.',
    href: '/devtools/json-schema',
    icon: Braces,
    category: 'Gestão de Dados',
    color: 'text-emerald-600',
    bg: 'bg-emerald-50',
    featured: true,
    iconSize: 'h-6 w-6'
  },
  {
    title: 'Planejador de Agendamentos (Cron)',
    description: 'Escreva e interprete regras de agendamento automático de tarefas.',
    href: '/devtools/cron-decoder',
    icon: Clock,
    category: 'Utilidades Diárias',
    color: 'text-orange-600',
    bg: 'bg-orange-50'
  },
  {
    title: 'Teste de Conexão e Rede',
    description: 'Verifique a velocidade, latência e o endereço de IP da sua rede.',
    href: '/devtools/ip-analyzer',
    icon: Globe,
    category: 'Privacidade & Segurança',
    color: 'text-cyan-600',
    bg: 'bg-cyan-50'
  },
  {
    title: 'Gerador de Documentos para Testes',
    description: 'Cria números válidos de CPF ou CNPJ para preenchimento de cadastros em teste.',
    href: '/devtools/doc-generator',
    icon: FileText,
    category: 'Gestão de Dados',
    color: 'text-emerald-600',
    bg: 'bg-emerald-50',
    featured: true,
    iconSize: 'h-6 w-6'
  },
  {
    title: 'Localizador de Endereços (CEP)',
    description: 'Busque informações de endereço completas a partir do CEP.',
    href: '/devtools/cep',
    icon: MapPin,
    category: 'Utilidades Diárias',
    color: 'text-orange-600',
    bg: 'bg-orange-50'
  },
  {
    title: 'Formatador e Contador de Textos',
    description: 'Conte palavras, mude para maiúsculas, remova acentos e inverta textos rapidamente.',
    href: '/devtools/string-master',
    icon: Type,
    category: 'Textos & Conteúdo',
    color: 'text-fuchsia-600',
    bg: 'bg-fuchsia-50'
  },
  {
    title: 'Calculadoras Rápidas',
    description: 'Calculadora de áreas geográficas, científica e cálculos básicos de escritório.',
    href: '/devtools/calculators',
    icon: Calculator,
    category: 'Cálculos & Medidas',
    color: 'text-blue-600',
    bg: 'bg-blue-50'
  },
  {
    title: 'Conversor de Datas e Fusos',
    description: 'Converta timestamps, calcule dias decorridos e consulte fusos horários.',
    href: '/devtools/date-time',
    icon: CalendarDays,
    category: 'Utilidades Diárias',
    color: 'text-orange-600',
    bg: 'bg-orange-50'
  },
  {
    title: 'Buscador de Padrões em Texto (Regex)',
    description: 'Crie expressões de busca para encontrar palavras ou formatos específicos em textos grandes.',
    href: '/devtools/regex-lab',
    icon: Binary,
    category: 'Utilidades Diárias',
    color: 'text-orange-600',
    bg: 'bg-orange-50',
    featured: true,
    iconSize: 'h-6 w-6'
  },
  {
    title: 'Validador de Tokens de Acesso',
    description: 'Analise tokens de autenticação localmente de forma segura.',
    href: '/devtools/jwt-inspector',
    icon: ShieldCheck,
    category: 'Privacidade & Segurança',
    color: 'text-cyan-600',
    bg: 'bg-cyan-50'
  },
  {
    title: 'Formatador de Consultas SQL',
    description: 'Organiza e embeleza consultas de banco de dados para facilitar a leitura.',
    href: '/devtools/sql-formatter',
    icon: SqlIcon,
    category: 'Gestão de Dados',
    color: 'text-blue-600',
    bg: 'bg-blue-50'
  },
  {
    title: 'Conversor YAML / JSON',
    description: 'Converte arquivos de configuração YAML para o formato legível JSON e vice-versa.',
    href: '/devtools/yaml-converter',
    icon: GitCompare,
    category: 'Formatadores & Conversores',
    color: 'text-indigo-600',
    bg: 'bg-indigo-50'
  },
  {
    title: 'Gerador de Códigos Únicos',
    description: 'Cria identificadores únicos e aleatórios (UUID) para identificação de registros.',
    href: '/devtools/uuid-generator',
    icon: Fingerprint,
    category: 'Geradores Auxiliares',
    color: 'text-rose-600',
    bg: 'bg-rose-50'
  },
  {
    title: 'Codificador de Links de Internet',
    description: 'Trata caracteres especiais de links para que funcionem corretamente em navegadores.',
    href: '/devtools/url-encoder',
    icon: LinkIcon,
    category: 'Utilidades Diárias',
    color: 'text-orange-600',
    bg: 'bg-orange-50'
  },
  {
    title: 'Validador de Chaves e Certificados',
    description: 'Analisa a segurança de certificados SSL e chaves públicas locais.',
    href: '/devtools/cert-inspector',
    icon: Key,
    category: 'Privacidade & Segurança',
    color: 'text-cyan-600',
    bg: 'bg-cyan-50'
  },
  {
    title: 'Cofre de Senhas e Anotações',
    description: 'Compartilhe credenciais criptografadas de ponta a ponta com links que se apagam sozinhos.',
    href: '/devtools/secret-vault',
    icon: ShieldCheck,
    category: 'Privacidade & Segurança',
    color: 'text-emerald-600',
    bg: 'bg-emerald-50',
    featured: true,
    iconSize: 'h-6 w-6'
  },
];

export default function DevToolsHomePage() {
  const [search, setSearch] = useState('');
  const [feedbackSignal, setFeedbackSignal] = useState<number | undefined>();

  React.useEffect(() => {
    document.title = `Central de Utilidades | Espaço Ágil`;
  }, []);

  const CATEGORY_ORDER = ['Gestão de Dados', 'Formatadores & Conversores', 'Textos & Conteúdo', 'Cálculos & Medidas', 'Design & Diagramas', 'Privacidade & Segurança', 'Geradores Auxiliares', 'Qualidade & Testes', 'Utilidades Diárias'];

  const filteredTools = TOOLS.filter(t =>
    t.title.toLowerCase().includes(search.toLowerCase()) ||
    t.description.toLowerCase().includes(search.toLowerCase()) ||
    t.category.toLowerCase().includes(search.toLowerCase())
  );

  const featuredTools = filteredTools.filter(t => t.featured);
  const regularTools = filteredTools.filter(t => !t.featured);

  const categories = CATEGORY_ORDER.filter(cat =>
    regularTools.some(t => t.category === cat)
  );

  return (
    <div className="flex-1 flex flex-col bg-slate-100/30 dark:bg-slate-950/30 relative overflow-hidden font-sans min-h-screen">
      {/* Mesh Background - HIGHER CONTRAST */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none -z-10">
        <div className="absolute top-[-10%] right-[-10%] w-[600px] h-[600px] bg-blue-200/20 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-5%] left-[-5%] w-[500px] h-[500px] bg-indigo-200/20 blur-[100px] rounded-full" />
      </div>

      <header className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between sticky top-0 z-30 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="p-2 bg-slate-900 rounded-xl shadow-lg active:scale-95 transition-transform cursor-pointer">
            <Logo className="h-5 w-5" />
          </div>
          <div className="flex flex-col">
            <h1 className="text-lg font-black italic tracking-tighter text-slate-800 uppercase leading-none">
              Util<span className="text-blue-600">Hub</span> <span className="text-[10px] not-italic text-slate-300 ml-1">v3.0</span>
            </h1>
            <p className="text-[8px] font-bold text-slate-500 uppercase tracking-[0.2em] mt-1">Central de Utilidades e Produtividade</p>
          </div>
        </div>

        <div className="flex-1 max-w-xl relative">
          <div className="absolute left-5 top-1/2 -translate-y-1/2 flex items-center gap-2 pointer-events-none">
            <Search className="h-4 w-4 text-slate-400" />
            <div className="h-4 w-px bg-slate-100 ml-1" />
          </div>
          <input
            placeholder="ENCONTRE O UTILITÁRIO..."
            className="w-full bg-slate-100/50 dark:bg-slate-900 border border-transparent dark:border-slate-800 rounded-xl pl-14 pr-4 h-10 text-[10px] font-bold uppercase tracking-widest text-slate-900 dark:text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/10 focus:bg-white dark:focus:bg-slate-900 focus:border-blue-200 dark:focus:border-blue-800 transition-all"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="absolute right-4 top-1/2 -translate-y-1/2 hidden md:flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 rounded md bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[8px] font-black text-slate-400">CTRL</kbd>
            <kbd className="px-1.5 py-0.5 rounded md bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[8px] font-black text-slate-400">K</kbd>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link href="/">
            <Button variant="ghost" size="icon" className="rounded-xl h-9 w-9 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <Badge variant="outline" className="h-9 px-3 rounded-xl text-[9px] font-black uppercase tracking-widest border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-350 bg-white dark:bg-slate-900 shadow-sm">
            {filteredTools.length} UTILITÁRIOS
          </Badge>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto px-4 py-6 md:px-8 scrollbar-thin scrollbar-thumb-slate-200 bg-slate-200/20 dark:bg-slate-950/20">
        <div className="max-w-[1920px] mx-auto space-y-6">

          {/* FEATURED TOOLS - BENTO HERO */}
          {featuredTools.length > 0 && (
            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-1 bg-blue-600 rounded-full" />
                  <h2 className="text-xs font-black uppercase tracking-widest italic text-slate-800 dark:text-slate-100">Principais Utilitários</h2>
                </div>
                <Badge variant="secondary" className="bg-slate-100 dark:bg-slate-850 text-slate-500 dark:text-slate-400 border-none text-[8px] font-black tracking-widest uppercase px-3">Destaques</Badge>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {featuredTools.map(tool => (
                  <div key={tool.href}>
                    <FeaturedCard tool={tool} />
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* GROUPED LISTS - BALANCED DENSITY */}
          {[
            { label: 'Gestão e Modelagem de Dados', categories: ['Gestão de Dados', 'Formatadores & Conversores', 'Geradores Auxiliares', 'Qualidade & Testes'], icon: Database },
            { label: 'Textos, Cálculos e Utilitários', categories: ['Utilidades Diárias', 'Textos & Conteúdo', 'Cálculos & Medidas'], icon: Zap },
            { label: 'Privacidade, Segurança e Organização', categories: ['Privacidade & Segurança', 'Design & Diagramas'], icon: ShieldCheck }
          ].map(group => (
            <section key={group.label} className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-sm flex items-center justify-center">
                  <group.icon className="h-4 w-4 text-slate-500 dark:text-slate-400" />
                </div>
                <div>
                  <h2 className="text-[11px] font-black uppercase tracking-widest text-slate-800 dark:text-slate-100 italic">{group.label}</h2>
                  <div className="h-0.5 w-12 bg-blue-600/20 rounded-full mt-1" />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-4">
                {regularTools.filter(t => group.categories.includes(t.category)).map((tool) => (
                  <ToolCard key={tool.href} tool={tool} />
                ))}
              </div>
            </section>
          ))}

          {filteredTools.length === 0 && (
            <div className="flex flex-col items-center justify-center py-40 animate-in fade-in zoom-in duration-500">
              <div className="p-8 bg-white dark:bg-slate-900 rounded-[3rem] shadow-2xl shadow-slate-200/50 dark:shadow-none mb-6 group">
                <Search className="h-12 w-12 text-slate-100 dark:text-slate-700 group-hover:scale-110 transition-transform duration-500" />
              </div>
              <h3 className="text-xl font-black italic uppercase tracking-tighter text-slate-800 dark:text-slate-100">Caminho não encontrado</h3>
              <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-[0.3em] mt-2">Refine sua busca no terminal acima</p>
              <Button variant="link" onClick={() => setSearch('')} className="mt-4 text-blue-600 font-black uppercase text-[10px]">Reiniciar Terminal</Button>
            </div>
          )}
        </div>
      </main>

      <Footer onOpenFeedback={() => setFeedbackSignal(Date.now())} />
      <FeedbackWidget
        toolName="Espaço Ágil - DevTools Hub"
        externalTriggerSignal={feedbackSignal}
        triggerVariant="none"
      />
    </div>
  );
}

function FeaturedCard({ tool, className }: { tool: any, className?: string }) {
  const Icon = tool.icon;
  return (
    <Link href={tool.href} className="group h-full block">
      <Card className={cn(
        "h-full rounded-xl border transition-all duration-500 group-hover:scale-[1.01] active:scale-[0.99] overflow-hidden relative p-4 flex flex-col justify-between shadow-sm",
        "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-blue-400/50 dark:hover:border-blue-500/50 hover:shadow-xl hover:shadow-blue-500/10 dark:hover:shadow-blue-500/5",
        className
      )}>
        {/* Subtle Side Accent */}
        <div className={cn("absolute left-0 top-0 bottom-0 w-1 opacity-0 group-hover:opacity-100 transition-opacity", tool.bg.replace('bg-', 'bg-'))} style={{ backgroundColor: 'currentColor' }} />
        <div className="relative z-10 space-y-3">
          <div className={cn(
            "p-2.5 rounded-xl w-fit shadow-sm transition-transform duration-500 group-hover:rotate-6",
            "bg-slate-50 dark:bg-slate-950/60"
          )}>
            <Icon className={cn(tool.iconSize || "h-5 w-5", tool.color)} />
          </div>

          <div className="space-y-1">
            <div className="text-[8px] font-black uppercase tracking-widest mb-1 opacity-60 text-slate-500 dark:text-slate-400">
              {tool.category}
            </div>
            <h3 className="text-base font-black italic leading-tight uppercase tracking-tighter text-slate-800 dark:text-slate-100">
              {tool.title}
            </h3>
          </div>
        </div>

        <div className="relative z-10 flex items-end justify-between pt-2">
          <p className="text-[9px] font-bold leading-relaxed max-w-[85%] uppercase tracking-wide text-slate-500 dark:text-slate-400">
            {tool.description}
          </p>
          <div className="h-8 w-8 rounded-xl flex items-center justify-center transition-all duration-300 bg-slate-50 dark:bg-slate-950/60 group-hover:bg-opacity-100">
            <ChevronRight className="h-3 w-3 text-slate-400 dark:text-slate-500" />
          </div>
        </div>
      </Card>
    </Link>
  );
}

function ToolCard({ tool }: { tool: any }) {
  const Icon = tool.icon;
  return (
    <Link href={tool.href} className="group">
      <Card className="h-full border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-blue-300 dark:hover:border-blue-800 hover:shadow-lg hover:shadow-blue-500/5 transition-all duration-300 p-4 rounded-xl group-hover:-translate-y-1 relative overflow-hidden flex flex-col gap-3 shadow-sm">
        <div className="flex items-center gap-3">
          <div className={cn("p-2 rounded-xl shrink-0 shadow-sm transition-transform duration-500 group-hover:scale-105", tool.bg, "dark:bg-slate-950/60")}>
            <Icon className={cn("h-4 w-4", tool.color)} />
          </div>
          <div className="min-w-0">
            <h4 className="text-[11px] font-black uppercase tracking-tight text-slate-800 dark:text-slate-100 group-hover:text-blue-600 transition-colors truncate">
              {tool.title}
            </h4>
            <span className="text-[8px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest leading-none block mt-1">{tool.category}</span>
          </div>
        </div>
        <p className="text-[9px] font-bold text-slate-500 dark:text-slate-400 leading-normal line-clamp-2 transition-colors group-hover:text-slate-700 dark:group-hover:text-slate-300">
          {tool.description}
        </p>
      </Card>
    </Link>
  );
}

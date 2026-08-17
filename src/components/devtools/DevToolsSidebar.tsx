'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  ArrowLeft,
  ArrowRightLeft,
  Zap,
  FileJson,
  FileCode,
  Settings2,
  ScanSearch,
  Code2,
  GitCompare,
  Network,
  Scan,
  TestTube,
  Database,
  FileText,
  Braces,
  ShieldCheck,
  Type,
  Calculator,
  Binary,
  MapPin,
  CalendarDays,
  Globe,
  Clock,
  Fingerprint,
  Link as LinkIcon,
  Key,
  Database as SqlIcon,
  FileSpreadsheet
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Logo } from '@/components/Logo';
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  useSidebar,
  SidebarTrigger,
} from '@/components/ui/sidebar';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

const NAV_GROUPS = [
  {
    label: 'Gestão de Dados',
    icon: Database,
    items: [
      { title: 'Formatador JSON', href: '/devtools/json', icon: FileJson },
      { title: 'Formatador XML', href: '/devtools/xml', icon: FileCode },
      { title: 'Validador de Regras', href: '/devtools/json-schema', icon: Braces },
      { title: 'Formatador SQL', href: '/devtools/sql-formatter', icon: SqlIcon },
      { title: 'Motor de Mock API', href: '/devtools/mock', icon: Database },
      { title: 'Gerador de Mocks', href: '/devtools/mock-factory', icon: Database },
      { title: 'Gerador de Documentos', href: '/devtools/doc-generator', icon: FileText },
    ]
  },
  {
    label: 'Formatadores & Conversores',
    icon: ArrowRightLeft,
    items: [
      { title: 'Conversor Jolt (JSON)', href: '/devtools/jolt', icon: ArrowRightLeft },
      { title: 'Mapeador Visual Jolt', href: '/devtools/visual-jolt-mapper', icon: GitCompare },
      { title: 'Sandbox Jolt (JSON)', href: '/jolt/sandbox', icon: ArrowRightLeft },
      { title: 'Mapeador Visual Jolt', href: '/jolt/visual', icon: GitCompare },
      { title: 'Conversor YAML/JSON', href: '/devtools/yaml-converter', icon: GitCompare },
    ]
  },
  {
    label: 'Textos & Conteúdo',
    icon: Type,
    items: [
      { title: 'Formatador de Textos', href: '/devtools/string-master', icon: Type },
    ]
  },
  {
    label: 'Cálculos & Medidas',
    icon: Calculator,
    items: [
      { title: 'Calculadoras Rápidas', href: '/devtools/calculators', icon: Calculator },
    ]
  },
  {
    label: 'Design & Diagramas',
    icon: Network,
    items: [
      { title: 'Quadro de Desenho', href: '/devtools/architecture', icon: Network },
    ]
  },
  {
    label: 'Privacidade & Segurança',
    icon: ScanSearch,
    items: [
      { title: 'Decodificador de Mensagens', href: '/devtools/deep-decoder', icon: ScanSearch },
      { title: 'Validador de Tokens JWT', href: '/devtools/jwt-inspector', icon: ShieldCheck },
      { title: 'Validador de Certificados', href: '/devtools/cert-inspector', icon: Key },
      { title: 'Teste de Rede & IP', href: '/devtools/ip-analyzer', icon: Globe },
      { title: 'Cofre de Senhas (Vault)', href: '/devtools/secret-vault', icon: ShieldCheck },
    ]
  },
  {
    label: 'Geradores Auxiliares',
    icon: Zap,
    items: [
      { title: 'Gerador de Modelos', href: '/devtools/type-generator', icon: Scan },
      { title: 'Modelador de Conexões', href: '/devtools/api-snippets', icon: Code2 },
      { title: 'Gerador de Códigos Únicos', href: '/devtools/uuid-generator', icon: Fingerprint },
    ]
  },
  {
    label: 'Qualidade & Testes',
    icon: TestTube,
    items: [
      { title: 'Modelos de Teste JUnit', href: '/devtools/junit-generator', icon: TestTube },
      { title: 'Conversor de Planilhas', href: '/devtools/xlsx-to-csv', icon: FileSpreadsheet },
    ]
  },
  {
    label: 'Utilidades Diárias',
    icon: Settings2,
    items: [
      { title: 'Codificador Base64', href: '/devtools/base64', icon: Zap },
      { title: 'Buscador de Padrões (Regex)', href: '/devtools/regex-lab', icon: Binary },
      { title: 'Localizador de CEP', href: '/devtools/cep', icon: MapPin },
      { title: 'Conversor de Datas & Fusos', href: '/devtools/date-time', icon: CalendarDays },
      { title: 'Comparador de Arquivos', href: '/devtools/diff', icon: GitCompare },
      { title: 'Planejador Cron', href: '/devtools/cron-decoder', icon: Clock },
      { title: 'Codificador de Links', href: '/devtools/url-encoder', icon: LinkIcon },
    ]
  },
];

export function DevToolsSidebar() {
  const pathname = usePathname();
  const { state } = useSidebar();
  const isCollapsed = state === 'collapsed';

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border bg-sidebar">
      {/* TOP NAVIGATION & CONTROLS */}
      <SidebarHeader className={cn("p-4 flex flex-row items-center gap-2", isCollapsed ? "justify-center p-2" : "justify-between")}>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button asChild variant="ghost" size={isCollapsed ? "icon" : "sm"} className={cn("font-bold text-muted-foreground hover:bg-sidebar-accent h-9 rounded-xl transition-all", isCollapsed ? "w-9" : "flex-1 justify-start px-3")}>
                <Link href="/">
                  <ArrowLeft className={cn("h-4 w-4", !isCollapsed && "mr-2")} />
                  {!isCollapsed && <span className="text-[10px] uppercase font-black tracking-widest text-sidebar-foreground">Início</span>}
                </Link>
              </Button>
            </TooltipTrigger>
            {isCollapsed && <TooltipContent side="right">Voltar para o Início</TooltipContent>}
          </Tooltip>
        </TooltipProvider>

        {!isCollapsed && (
          <SidebarTrigger className="h-9 w-9 text-muted-foreground hover:text-foreground hover:bg-sidebar-accent transition-all rounded-xl border border-sidebar-border" />
        )}
      </SidebarHeader>

      <div className="px-4 mb-2">
        <Separator className="bg-sidebar-border" />
      </div>

      {/* NAVIGATION SECTION - CATEGORIZED */}
      <SidebarContent className="px-3 pb-8 scrollbar-thin scrollbar-thumb-slate-100">
        <div className="space-y-6 pt-4">
          {NAV_GROUPS.map((group) => (
            <div key={group.label} className="space-y-1">
              {!isCollapsed && (
                <div className="px-3 mb-2 flex items-center gap-2">
                  <span className="text-[9px] font-black text-slate-500 uppercase tracking-[0.3em] italic">{group.label}</span>
                </div>
              )}
              <SidebarMenu className="space-y-0.5">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = pathname === item.href;

                  return (
                    <SidebarMenuItem key={item.href}>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <SidebarMenuButton
                              asChild
                              className={cn(
                                "flex items-center gap-3 px-3 rounded-xl transition-all group h-9 w-full justify-start",
                                isActive
                                  ? "bg-slate-900 text-white shadow-xl shadow-slate-900/10 active:scale-[0.98] hover:bg-slate-800 hover:text-white dark:bg-primary dark:hover:bg-primary/90"
                                  : "text-muted-foreground hover:bg-sidebar-accent hover:text-foreground"
                              )}
                            >
                              <Link href={item.href}>
                                <Icon className={cn("h-4 w-4 shrink-0 transition-all duration-300", isActive ? "text-blue-400" : "text-slate-400 group-hover:text-blue-500 group-hover:scale-110")} />
                                {!isCollapsed && <span className={cn("text-[11px] font-bold tracking-tight", isActive ? "text-white" : "text-slate-700")}>{item.title}</span>}
                              </Link>
                            </SidebarMenuButton>
                          </TooltipTrigger>
                          {isCollapsed && <TooltipContent side="right" className="font-bold bg-slate-900 border-none text-[10px] text-white py-1 px-2">{item.title}</TooltipContent>}
                        </Tooltip>
                      </TooltipProvider>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </div>
          ))}
        </div>
      </SidebarContent>
    </Sidebar>
  );
}

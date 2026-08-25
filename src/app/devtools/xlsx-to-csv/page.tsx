'use client';

import React, { useState, useEffect, useRef } from 'react';
import { getAuthToken } from '@/lib/auth-client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  ArrowLeft, 
  Copy, 
  RotateCcw,
  Download,
  FileSpreadsheet,
  FileText,
  AlertCircle,
  Check,
  Table,
  Upload,
  Layers,
  Zap,
  Info,
  ChevronDown,
  ChevronUp,
  Search,
  Database,
  Key,
  Send,
  Loader2,
  Settings2,
  Sparkles,
  History,
  Trash2,
  Eye,
  EyeOff
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { useJiraSettings } from '@/hooks/useJiraSettings';

interface SheetData {
  name: string;
  csv: string;
  json: any[]; // Mantém todos os campos originais
}

// Definição das colunas padrão do Zephyr
const DEFAULT_COLUMNS = [
  { key: 'Key', label: 'Key', defaultVisible: true },
  { key: 'Name', label: 'Name', defaultVisible: true },
  { key: 'Status', label: 'Status', defaultVisible: true },
  { key: 'Precondition', label: 'Precondition', defaultVisible: true },
  { key: 'Objective', label: 'Objective', defaultVisible: false },
  { key: 'Folder', label: 'Folder', defaultVisible: true },
  { key: 'Priority', label: 'Priority', defaultVisible: true },
  { key: 'Component', label: 'Component', defaultVisible: true },
  { key: 'Labels', label: 'Labels', defaultVisible: false },
  { key: 'Owner', label: 'Owner', defaultVisible: false },
  { key: 'Estimated Time', label: 'Estimated Time', defaultVisible: false },
  { key: 'Coverage (Issues)', label: 'Coverage (Issues)', defaultVisible: true },
  { key: 'Coverage (Pages)', label: 'Coverage (Pages)', defaultVisible: false },
  { key: 'Automatizado?', label: 'Automatizado?', defaultVisible: true },
  { key: 'Fluxo', label: 'Fluxo', defaultVisible: true },
  { key: 'Funcionalidade', label: 'Funcionalidade', defaultVisible: true },
  { key: 'ID Automatizado', label: 'ID Automatizado', defaultVisible: true },
  { key: 'Jornada', label: 'Jornada', defaultVisible: true },
  { key: 'Step', label: 'Step', defaultVisible: true },
  { key: 'Test Data', label: 'Test Data', defaultVisible: true },
  { key: 'Expected Result', label: 'Expected Result', defaultVisible: true },
  { key: 'Plain Text', label: 'Plain Text', defaultVisible: false },
  { key: 'BDD', label: 'BDD', defaultVisible: false }
];

export default function XlsxToCsvPage() {
  const { toast } = useToast();
  
  // Estados Gerais
  const [libLoaded, setLibLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [sheets, setSheets] = useState<SheetData[]>([]);
  const [activeSheetIndex, setActiveSheetIndex] = useState<number>(0);
  const [copied, setCopied] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showCsvPreview, setShowCsvPreview] = useState(false);
  const [activeTab, setActiveTab] = useState<'upload' | 'jira'>('upload');
  
  // Opções Avançadas de QA
  const [cleanFormatting, setCleanFormatting] = useState(false);
  const [showColumnConfig, setShowColumnConfig] = useState(false);
  const [columnVisibility, setColumnVisibility] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    DEFAULT_COLUMNS.forEach(col => {
      initial[col.key] = col.defaultVisible;
    });
    return initial;
  });
  
  // Estados do Jira
  const [jiraKey, setJiraKey] = useState('');
  const [jiraPat, setJiraPat] = useState('');
  const [recentKeys, setRecentKeys] = useState<string[]>([]);
  const [saveCredentials, setSaveCredentials] = useState(true);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Configurações Globais do Jira (Postgres via Spring Boot)
  const { settings: jiraGlobalSettings } = useJiraSettings();

  // Carregar credenciais e histórico no primeiro acesso
  useEffect(() => {
    // 1. Tentar ler do Perfil salvo no backend
    if (jiraGlobalSettings?.token) {
      setJiraPat(jiraGlobalSettings.token);
    } else if (typeof window !== 'undefined') {
      // 2. Se não houver token salvo, ler do LocalStorage
      const savedPat = localStorage.getItem('jira_pat');
      if (savedPat) setJiraPat(savedPat);
    }

    // Carregar histórico de chaves recentes
    if (typeof window !== 'undefined') {
      const savedKeys = localStorage.getItem('jira_recent_keys');
      if (savedKeys) {
        try {
          setRecentKeys(JSON.parse(savedKeys));
        } catch (_) {}
      }
    }
  }, [jiraGlobalSettings]);

  // Carregar biblioteca ExcelJS dinamicamente
  useEffect(() => {
    if (typeof window !== 'undefined') {
      if ((window as any).ExcelJS) {
        setLibLoaded(true);
        return;
      }

      const checkInterval = setInterval(() => {
        if ((window as any).ExcelJS) {
          setLibLoaded(true);
          clearInterval(checkInterval);
        }
      }, 500);

      const script = document.createElement('script');
      script.src = "https://cdn.jsdelivr.net/npm/exceljs@4.4.0/dist/exceljs.min.js";
      script.async = true;
      script.onload = () => {
        setLibLoaded(true);
        clearInterval(checkInterval);
      };
      script.onerror = () => {
        console.error("Erro ao carregar o motor ExcelJS.");
      };
      document.body.appendChild(script);

      return () => {
        clearInterval(checkInterval);
      };
    }
  }, []);

  // Limpador de tags HTML e notações markdown
  const cleanStepText = (text: string) => {
    if (!text) return '';
    
    // Remove tags HTML
    let cleaned = text.replace(/<[^>]*>/g, '');
    
    // Decodifica entidades HTML básicas
    cleaned = cleaned
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'");

    // Remove notações markdown comuns de poluição (como negritos extras, itálicos e riscos)
    cleaned = cleaned.replace(/[\*_~`]/g, '');

    // Ajusta espaços duplos
    cleaned = cleaned.replace(/\s+/g, ' ');

    return cleaned.trim();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      processFile(files[0]);
    }
  };

  const processFile = async (file: File) => {
    if (!libLoaded || !(window as any).ExcelJS) {
      toast({
        title: "Motor de planilhas carregando...",
        description: "Aguarde a inicialização do motor de planilhas.",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    setFileName(file.name);
    
    try {
      const ExcelJS = (window as any).ExcelJS;
      const reader = new FileReader();
      
      reader.onload = async (e: any) => {
        try {
          const arrayBuffer = e.target.result;
          const workbook = new ExcelJS.Workbook();
          await workbook.xlsx.load(arrayBuffer);
          
          const parsedSheets: SheetData[] = [];
          
          workbook.eachSheet((worksheet: any) => {
            const json: any[] = [];
            
            worksheet.eachRow({ includeEmpty: true }, (row: any) => {
              const rowJson: any[] = [];
              const cellCount = Math.max(row.cellCount, DEFAULT_COLUMNS.length);
              
              for (let colIdx = 1; colIdx <= cellCount; colIdx++) {
                const cell = row.getCell(colIdx);
                let value = cell.value;
                
                if (value && typeof value === 'object') {
                  if (value.richText) {
                    value = value.richText.map((t: any) => t.text).join('');
                  } else if (value.result !== undefined) {
                    value = value.result;
                  } else if (value.text !== undefined && value.hyperlink !== undefined) {
                    value = value.text;
                  } else if (value instanceof Date) {
                    value = value.toLocaleString();
                  } else {
                    value = JSON.stringify(value);
                  }
                }
                rowJson.push(value);
              }
              json.push(rowJson);
            });
            
            parsedSheets.push({
              name: worksheet.name,
              csv: '', // Gerado dinamicamente com base nas colunas visíveis
              json: json
            });
          });

          if (parsedSheets.length === 0) {
            throw new Error("Nenhuma aba encontrada na planilha.");
          }

          setSheets(parsedSheets);
          setActiveSheetIndex(0);
          toast({
            title: "Planilha carregada!",
            description: `Mapeada(s) ${parsedSheets.length} aba(s) com sucesso.`
          });
        } catch (error: any) {
          console.error(error);
          toast({
            title: "Erro ao ler arquivo",
            description: error.message || "Erro ao processar estrutura da planilha.",
            variant: "destructive"
          });
          setFileName(null);
          setSheets([]);
        } finally {
          setLoading(false);
        }
      };

      reader.onerror = () => {
        toast({
          title: "Erro na leitura",
          description: "Não foi possível ler o arquivo do disco.",
          variant: "destructive"
        });
        setLoading(false);
      };

      reader.readAsArrayBuffer(file);
    } catch (error: any) {
      console.error(error);
      toast({
        title: "Erro ao iniciar leitura",
        description: error.message || "Erro interno ao processar o arquivo.",
        variant: "destructive"
      });
      setLoading(false);
    }
  };

  // Buscar caso de teste único
  const fetchTestCase = async (key: string, pat: string) => {
    // Método 1: Chamada via Proxy Server-side
    const idToken = getAuthToken();
    const res = await fetch('/api/jira/testcase', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(idToken ? { 'Authorization': `Bearer ${idToken}` } : {}),
      },
      body: JSON.stringify({ testCaseKey: key, pat })
    });

    if (!res.ok) {
      const errText = await res.text();
      let errorMsg = `Erro na API para o caso ${key}`;
      try {
        const errData = JSON.parse(errText);
        errorMsg = errData.error || errorMsg;
      } catch (_) {
        if (errText.includes('cloudflare') || errText.includes('Attention Required')) {
          errorMsg = `Acesso bloqueado pelo firewall para ${key}.`;
        }
      }
      throw new Error(errorMsg);
    }

    return await res.json();
  };

  // Processar busca direta no Jira (Suporta múltiplos IDs separados por vírgula)
  const handleJiraImport = async () => {
    if (!jiraKey) {
      toast({
        title: "Código do caso necessário",
        description: "Digite um ou mais IDs de casos de teste (ex: PROJ-T267, PROJ-T268).",
        variant: "destructive"
      });
      return;
    }

    if (!jiraPat) {
      toast({
        title: "Token necessário",
        description: "Por favor, insira o seu Personal Access Token do Jira.",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    const keys = jiraKey.split(',').map(k => k.trim().toUpperCase()).filter(Boolean);
    setFileName(keys.length === 1 ? `${keys[0]}.xlsx` : `Consolidado (${keys.length} Casos).xlsx`);

    // Salvar token no localStorage
    if (typeof window !== 'undefined') {
      if (saveCredentials) {
        localStorage.setItem('totvs_jira_pat', jiraPat);
      } else {
        localStorage.removeItem('totvs_jira_pat');
      }
    }

    try {
      // Executar buscas em paralelo
      const fetchPromises = keys.map(key => fetchTestCase(key, jiraPat.trim()));
      const results = await Promise.all(fetchPromises);
      
      const consolidatedJsonRows: any[] = [];
      
      // Cabeçalho estático padrão
      const headers = DEFAULT_COLUMNS.map(col => col.key);
      consolidatedJsonRows.push(headers);
      
      // Adicionar resultados ao lote consolidado
      results.forEach((data, index) => {
        const key = keys[index];
        const steps = data.testScript?.steps || [];
        
        const getCustomField = (name: string) => {
          if (data.customFields && data.customFields[name] !== undefined) {
            return data.customFields[name];
          }
          if (Array.isArray(data.customFieldValues)) {
            const field = data.customFieldValues.find((cf: any) => cf.customField?.name === name);
            return field ? field.value : '';
          }
          return '';
        };

        const formatEstimatedTime = (time: any) => {
          if (typeof time === 'number') {
            const hours = Math.floor(time / 3600);
            const minutes = Math.floor((time % 3600) / 60);
            const formatNum = (n: number) => String(n).padStart(2, '0');
            return `${formatNum(hours)}:${formatNum(minutes)}`;
          }
          return String(time || '');
        };

        const issueLinks = Array.isArray(data.issueLinks) 
          ? data.issueLinks.map((il: any) => typeof il === 'string' ? il : il.key).join(', ')
          : '';

        const labels = Array.isArray(data.labels) ? data.labels.join(', ') : '';
        const folder = typeof data.folder === 'object' && data.folder !== null 
          ? data.folder.name || data.folder.id || '' 
          : String(data.folder || '');

        const baseRow = [
          data.key || key,
          data.name || '',
          data.status || '',
          data.precondition || '',
          data.objective || '',
          folder,
          data.priority || '',
          data.component || '',
          labels,
          data.owner || '',
          formatEstimatedTime(data.estimatedTime),
          issueLinks,
          '', // Coverage Pages
          getCustomField("Automatizado?"),
          getCustomField("Fluxo"),
          getCustomField("Funcionalidade"),
          getCustomField("ID Automatizado"),
          getCustomField("Jornada")
        ];

        if (steps.length > 0) {
          steps.forEach((step: any) => {
            consolidatedJsonRows.push([
              ...baseRow,
              step.description || step.step || '',
              step.testData || '',
              step.expectedResult || '',
              '', // Plain Text
              ''  // BDD
            ]);
          });
        } else {
          consolidatedJsonRows.push([
            ...baseRow,
            '', // Step
            '', // Test Data
            '', // Expected Result
            data.testScript?.text || '',
            data.testScript?.bdd || ''
          ]);
        }
      });

      setSheets([{
        name: 'Jira Export',
        csv: '', // Gerado dinamicamente com base nas colunas visíveis
        json: consolidatedJsonRows
      }]);
      setActiveSheetIndex(0);

      // Atualizar histórico de buscas
      if (typeof window !== 'undefined') {
        const nextKeys = Array.from(new Set([...keys, ...recentKeys])).slice(0, 8);
        setRecentKeys(nextKeys);
        localStorage.setItem('totvs_jira_recent_keys', JSON.stringify(nextKeys));
      }

      toast({
        title: "Casos de teste importados!",
        description: `Importação paralela de ${keys.length} caso(s) de teste concluída.`
      });
    } catch (error: any) {
      console.error(error);
      toast({
        title: "Erro na importação em lote",
        description: error.message || "Verifique as chaves digitadas e suas credenciais.",
        variant: "destructive"
      });
      setFileName(null);
      setSheets([]);
    } finally {
      setLoading(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      const file = files[0];
      if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
        processFile(file);
      } else {
        toast({
          title: "Formato inválido",
          description: "Por favor, envie apenas arquivos com extensão .xlsx ou .xls",
          variant: "destructive"
        });
      }
    }
  };

  const handleReset = () => {
    setFileName(null);
    setSheets([]);
    setActiveSheetIndex(0);
    setSearchTerm('');
    setShowCsvPreview(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const toggleColumnVisibility = (key: string) => {
    setColumnVisibility(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const clearRecentKeys = () => {
    setRecentKeys([]);
    if (typeof window !== 'undefined') {
      localStorage.removeItem('totvs_jira_recent_keys');
    }
    toast({
      title: "Histórico limpo",
      description: "Seu histórico de buscas locais foi apagado."
    });
  };

  // Gerar o CSV final dinamicamente filtrando as colunas desmarcadas e aplicando limpeza opcional
  const getProcessedCsv = () => {
    if (sheets.length === 0) return '';
    const activeSheet = sheets[activeSheetIndex];
    const allRows = activeSheet.json;
    if (allRows.length === 0) return '';

    // Mapear os indexes das colunas que estão visíveis
    const headers = allRows[0];
    const visibleIndexes: number[] = [];

    // O cabeçalho determina os campos padrão (mapeando a posição)
    DEFAULT_COLUMNS.forEach((col, index) => {
      if (columnVisibility[col.key]) {
        visibleIndexes.push(index);
      }
    });

    const processedRows = allRows.map((row, rowIdx) => {
      const filteredCells = visibleIndexes.map(idx => {
        let cellVal = row[idx];
        
        // Se for uma linha de dados (não cabeçalho) e a limpeza estiver ativa nas colunas de script
        if (rowIdx > 0 && cleanFormatting && (idx === 18 || idx === 19 || idx === 20)) {
          cellVal = cleanStepText(String(cellVal || ''));
        }

        let strVal = cellVal !== null && cellVal !== undefined ? String(cellVal) : '';
        // Escapar no padrão CSV
        if (strVal.includes(',') || strVal.includes('"') || strVal.includes('\n') || strVal.includes('\r')) {
          strVal = '"' + strVal.replace(/"/g, '""') + '"';
        }
        return strVal;
      });
      return filteredCells.join(',');
    });

    return processedRows.join('\n') + '\n';
  };

  const handleDownload = () => {
    if (sheets.length === 0) return;
    const csvContent = getProcessedCsv();
    const activeSheet = sheets[activeSheetIndex];
    
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    
    const originalBaseName = fileName ? fileName.replace(/\.[^/.]+$/, "") : "export";
    link.setAttribute('href', url);
    link.setAttribute('download', `${originalBaseName} - ${activeSheet.name}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast({
      title: "Download concluído!",
      description: "O arquivo CSV filtrado foi baixado."
    });
  };

  const handleCopyToClipboard = () => {
    if (sheets.length === 0) return;
    navigator.clipboard.writeText(getProcessedCsv());
    setCopied(true);
    toast({
      title: "Copiado!",
      description: "Código CSV filtrado copiado para a área de transferência."
    });
    setTimeout(() => setCopied(false), 2000);
  };

  const currentSheet = sheets[activeSheetIndex];
  const allRows = currentSheet ? currentSheet.json : [];
  
  // Pegar os cabeçalhos das colunas visíveis
  const visibleHeaders = DEFAULT_COLUMNS.filter(col => columnVisibility[col.key]);
  
  // Pegar as colunas originais do cabeçalho
  const rawHeaders = allRows.length > 0 ? allRows[0] : [];
  
  // Filtrar as linhas de dados da tabela
  const rawDataRows = allRows.length > 1 ? allRows.slice(1) : [];
  const filteredDataRows = rawDataRows.filter((row: any[]) => {
    if (!searchTerm) return true;
    return row.some(cell => 
      cell !== undefined && 
      cell !== null && 
      String(cell).toLowerCase().includes(searchTerm.toLowerCase())
    );
  });

  // Mapear linhas para exibição na tabela (exibindo apenas as colunas marcadas como visíveis e aplicando a limpeza se ativa)
  const previewDataRows = filteredDataRows.map((row) => {
    return DEFAULT_COLUMNS.map((col, index) => {
      let val = row[index];
      if (cleanFormatting && (col.key === 'Step' || col.key === 'Test Data' || col.key === 'Expected Result')) {
        val = cleanStepText(String(val || ''));
      }
      return val;
    });
  });

  const totalRowsCount = allRows.length > 0 ? allRows.length - 1 : 0;
  const totalColsCount = visibleHeaders.length;

  return (
    <div className="flex flex-col h-screen bg-slate-50 text-slate-800 font-sans overflow-hidden">
      
      {/* Header Clássico Zephyr Bridge */}
      <header className="px-8 py-5 border-b border-slate-200 bg-white flex items-center justify-between shrink-0 shadow-sm z-10">
        <div className="flex items-center gap-4">
          <Link href="/devtools">
            <Button variant="ghost" size="icon" className="rounded-xl h-10 w-10 text-slate-400 hover:text-slate-900 transition-all border border-slate-200 bg-white animate-in fade-in zoom-in duration-300">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div className="flex flex-col">
            <h1 className="text-lg font-black italic uppercase tracking-tighter text-slate-800 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-blue-600 animate-pulse" />
              Zephyr <span className="text-blue-600">Bridge</span>
            </h1>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em]">QA Test Case Exporter & Toolkit</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="h-6 px-3 text-[9px] font-black uppercase tracking-widest border-blue-200 text-blue-600 bg-blue-50">
            QA Tool
          </Badge>
          {(fileName || sheets.length > 0) && (
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleReset}
              className="h-9 px-4 rounded-xl text-[9px] font-black uppercase tracking-widest gap-2 bg-white shadow-sm border-slate-200"
            >
              <RotateCcw className="h-3 w-3" /> Reiniciar
            </Button>
          )}
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 flex overflow-hidden">
        <div className="flex-1 flex flex-col p-8 gap-6 overflow-hidden">
          
          {/* Status da Biblioteca */}
          {!libLoaded && (
            <div className="bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded-2xl flex items-center gap-3 text-xs font-bold uppercase tracking-wider shadow-sm shrink-0">
              <AlertCircle className="h-5 w-5 text-amber-500 animate-pulse" />
              Carregando motor ExcelJS e configurações...
            </div>
          )}

          {sheets.length === 0 ? (
            /* Choose Import Mode when no file loaded */
            <div className="flex-1 flex flex-col gap-6 max-w-6xl mx-auto w-full justify-start mt-4 overflow-y-auto pr-2">
              
              {/* Tab Selector */}
              <div className="flex bg-slate-200/50 p-1.5 rounded-2xl w-fit mx-auto border border-slate-200 shrink-0">
                <button
                  onClick={() => setActiveTab('upload')}
                  className={cn(
                    "px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                    activeTab === 'upload' ? "bg-white text-blue-600 shadow-md border border-slate-200/50" : "text-slate-500 hover:text-slate-800"
                  )}
                >
                  <Upload className="h-3.5 w-3.5 inline mr-2" /> Upload de Planilha (.XLSX)
                </button>
                <button
                  onClick={() => setActiveTab('jira')}
                  className={cn(
                    "px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                    activeTab === 'jira' ? "bg-white text-blue-600 shadow-md border border-slate-200/50" : "text-slate-500 hover:text-slate-800"
                  )}
                >
                  <Database className="h-3.5 w-3.5 inline mr-2" /> Importação Direta Jira
                </button>
              </div>

              {activeTab === 'upload' ? (
                /* Upload Box - Light Theme */
                <div 
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className="flex-1 min-h-[350px] border-2 border-dashed border-slate-200 hover:border-blue-400 hover:bg-blue-50/20 transition-all duration-300 rounded-[2.5rem] bg-white flex flex-col items-center justify-center p-8 text-center cursor-pointer group shadow-sm"
                >
                  <input 
                    type="file" 
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    accept=".xlsx, .xls"
                    className="hidden"
                  />
                  <div className="p-8 bg-slate-50 group-hover:bg-blue-50 group-hover:scale-105 transition-all rounded-[2rem] mb-6 shadow-inner border border-slate-100">
                    {loading ? (
                      <Loader2 className="h-12 w-12 text-blue-600 animate-spin" />
                    ) : (
                      <Upload className="h-12 w-12 text-slate-400 group-hover:text-blue-500 transition-colors" />
                    )}
                  </div>
                  <h3 className="text-base font-black italic uppercase tracking-tighter text-slate-800">
                    {loading ? "Lendo dados da planilha..." : "Solte sua planilha exportada do Zephyr aqui"}
                  </h3>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.25em] mt-2 max-w-sm leading-relaxed">
                    ou clique para abrir seus arquivos (.xlsx ou .xls)
                  </p>
                </div>
              ) : (
                /* Jira Fetch Box */
                <div className="flex flex-col gap-6">
                  <Card className="border-slate-200 bg-white rounded-[2.5rem] shadow-sm p-8 flex flex-col md:flex-row gap-8 items-stretch">
                    
                    {/* Left Side: Auth & Params Form */}
                    <div className="flex-1 flex flex-col gap-5 justify-center">
                      
                      {/* PAT Token Input */}
                      <div className="flex flex-col gap-1.5">
                        <div className="flex items-center justify-between">
                          <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Jira Personal Access Token (PAT)</label>
                          {jiraGlobalSettings?.token && (
                            <span className="text-[8px] font-bold text-green-600 flex items-center gap-1 bg-green-50 px-2 py-0.5 rounded-md border border-green-200">
                              <Check className="h-3 w-3" /> PERFIL CONECTADO
                            </span>
                          )}
                        </div>
                        <div className="relative">
                          <Key className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                          <input
                            type="password"
                            placeholder="Insira seu Token do Jira..."
                            value={jiraPat}
                            onChange={(e) => setJiraPat(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-11 pr-4 h-11 text-xs focus:outline-none focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100 text-slate-700 transition-all"
                          />
                        </div>
                      </div>

                      {/* Test Case Input */}
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Código do Caso de Teste (Separados por vírgula para exportar lote)</label>
                        <div className="relative">
                          <FileSpreadsheet className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-blue-500" />
                          <input
                            type="text"
                            placeholder="Ex: PROJ-T267, PROJ-T268..."
                            value={jiraKey}
                            onChange={(e) => setJiraKey(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-11 pr-4 h-11 text-xs font-bold uppercase tracking-wide focus:outline-none focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100 text-slate-700 transition-all placeholder:normal-case placeholder:font-normal"
                          />
                        </div>
                      </div>

                      <div className="flex items-center gap-2 mt-1">
                        <input 
                          type="checkbox" 
                          id="save_creds" 
                          checked={saveCredentials}
                          onChange={(e) => setSaveCredentials(e.target.checked)}
                          className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-4 w-4"
                        />
                        <label htmlFor="save_creds" className="text-[9px] font-bold text-slate-400 uppercase tracking-wider select-none cursor-pointer">
                          Lembrar minhas credenciais localmente (Seguro)
                        </label>
                      </div>

                      <Button
                        onClick={handleJiraImport}
                        disabled={loading}
                        className="h-12 mt-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black uppercase tracking-[0.2em] text-[10px] shadow-sm gap-2 transition-all active:scale-[0.98] w-full"
                      >
                        {loading ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin animate-in fade-in" /> Buscando em paralelo...
                          </>
                        ) : (
                          <>
                            <Send className="h-3.5 w-3.5" /> Consultar & Gerar CSV Unificado
                          </>
                        )}
                      </Button>
                    </div>

                    {/* Right Side: Informative panel */}
                    <div className="hidden md:flex w-72 bg-slate-50 border border-slate-200/60 rounded-[1.5rem] p-6 flex-col justify-between">
                      <div className="space-y-4">
                        <div className="flex items-center gap-2 text-blue-600">
                          <Sparkles className="h-4 w-4" />
                          <span className="text-[9px] font-black uppercase tracking-wider">Como funciona?</span>
                        </div>
                        <h4 className="text-xs font-extrabold text-slate-700 leading-snug">Busca e Consolidação Inteligente</h4>
                        <p className="text-[10px] text-slate-400 leading-relaxed">
                          Ao digitar múltiplos IDs (separados por vírgula), o **Zephyr Bridge** dispara requisições assíncronas em paralelo para a API Zephyr do Jira, agrupa todas as tabelas de passos e formata um único CSV unificado pronto para download.
                        </p>
                      </div>
                      
                      <div className="flex items-center gap-2 text-[8px] font-black text-slate-400 tracking-wider bg-white p-2.5 rounded-lg border border-slate-200">
                        <Info className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                        <span>Seus tokens são armazenados apenas no seu navegador.</span>
                      </div>
                    </div>

                  </Card>

                  {/* Histórico Recente */}
                  {recentKeys.length > 0 && (
                    <Card className="border-slate-200 bg-white rounded-[1.5rem] shadow-sm p-5 flex flex-col gap-3">
                      <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                        <div className="flex items-center gap-2 text-slate-600">
                          <History className="h-4 w-4" />
                          <span className="text-[9px] font-black uppercase tracking-wider">Consultados Recentemente</span>
                        </div>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={clearRecentKeys}
                          className="h-6 text-[8px] font-black text-rose-500 uppercase tracking-widest hover:bg-rose-50 rounded-md gap-1"
                        >
                          <Trash2 className="h-3 w-3" /> Limpar Histórico
                        </Button>
                      </div>
                      <div className="flex flex-wrap gap-2 pt-1">
                        {recentKeys.map((key) => (
                          <button
                            key={key}
                            onClick={() => {
                              // Se já tiver uma chave digitada, adiciona com vírgula, senão substitui
                              setJiraKey(prev => prev ? `${prev}, ${key}` : key);
                              toast({
                                title: "Chave adicionada",
                                description: `ID ${key} copiado para a consulta.`,
                              });
                            }}
                            className="px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest border border-slate-200 bg-slate-50 hover:bg-slate-100 hover:border-slate-300 text-slate-600 transition-all cursor-pointer"
                          >
                            + {key}
                          </button>
                        ))}
                      </div>
                    </Card>
                  )}
                </div>
              )}

            </div>
          ) : (
            /* Active Mode Workspace */
            <div className="flex-1 flex flex-col gap-6 overflow-hidden animate-in fade-in zoom-in duration-300">
              
              {/* Meta bar */}
              <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between bg-white border border-slate-200 p-4 rounded-3xl gap-4 shrink-0 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-blue-50 border border-blue-100 rounded-xl text-blue-600">
                    <FileSpreadsheet className="h-5 w-5" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Planilha Ativa</span>
                    <span className="text-sm font-bold text-slate-800">{fileName}</span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  {/* Abas */}
                  {sheets.length > 1 && (
                    <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
                      {sheets.map((sheet, index) => (
                        <button
                          key={sheet.name}
                          onClick={() => { setActiveSheetIndex(index); setSearchTerm(''); }}
                          className={cn(
                            "px-4 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all",
                            activeSheetIndex === index 
                              ? "bg-white text-blue-600 shadow-sm border border-slate-200/50" 
                              : "text-slate-500 hover:text-slate-800"
                          )}
                        >
                          {sheet.name}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Badges de Contagem */}
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="bg-slate-50 border-slate-200 h-8 px-3 text-[9px] font-bold text-slate-600 uppercase tracking-widest gap-2">
                      <Database className="h-3 w-3 text-slate-400" />
                      {totalRowsCount} Linhas
                    </Badge>
                    <Badge variant="outline" className="bg-slate-50 border-slate-200 h-8 px-3 text-[9px] font-bold text-slate-600 uppercase tracking-widest gap-2">
                      <Layers className="h-3 w-3 text-slate-400" />
                      {totalColsCount} Colunas
                    </Badge>
                  </div>
                </div>
              </div>

              {/* Tabela de Prévia ocupando quase todo o espaço */}
              <div className="flex-1 flex flex-col gap-3 overflow-hidden">
                <div className="flex items-center justify-between px-2 shrink-0">
                  <div className="flex items-center gap-3">
                    <Table className="h-4 w-4 text-slate-400" />
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Prévia dos Dados da Planilha</span>
                  </div>

                  {/* Controles de QA Avançados (Limpador e Filtro de Colunas) */}
                  <div className="flex items-center gap-4">
                    
                    {/* Toggle: Limpar Tags HTML */}
                    <div className="flex items-center gap-2 bg-white border border-slate-200 px-3 py-1.5 rounded-xl shadow-sm">
                      <input 
                        type="checkbox"
                        id="clean_html_check"
                        checked={cleanFormatting}
                        onChange={(e) => {
                          setCleanFormatting(e.target.checked);
                          toast({
                            title: e.target.checked ? "Limpador Ativo" : "Limpador Inativo",
                            description: e.target.checked ? "Tags HTML e formatação do Jira serão limpas na visualização e exportação." : "A formatação original do Jira será mantida."
                          });
                        }}
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-3.5 w-3.5 cursor-pointer"
                      />
                      <label htmlFor="clean_html_check" className="text-[8px] font-black text-slate-500 uppercase tracking-widest cursor-pointer select-none">
                        Limpar Tags & HTML
                      </label>
                    </div>

                    {/* Botão: Configurar Colunas */}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowColumnConfig(!showColumnConfig)}
                      className={cn(
                        "h-8 text-[8px] font-black uppercase tracking-widest rounded-xl shadow-sm border-slate-200 gap-1.5",
                        showColumnConfig && "bg-blue-50 border-blue-200 text-blue-600"
                      )}
                    >
                      {showColumnConfig ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                      {showColumnConfig ? "Fechar Colunas" : "Ver/Ocultar Colunas"}
                    </Button>

                    {/* Filtro Rápido */}
                    <div className="relative w-48 md:w-64">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                      <input 
                        type="text"
                        placeholder="FILTRAR CASOS DE TESTE..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-lg pl-8 pr-3 py-1.5 text-[9px] font-bold tracking-widest placeholder:text-slate-400 focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 text-slate-700 transition-all uppercase"
                      />
                    </div>
                  </div>
                </div>

                {/* Painel de Visibilidade de Colunas */}
                {showColumnConfig && (
                  <Card className="p-4 border-slate-200 bg-white rounded-2xl shadow-sm shrink-0 animate-in slide-in-from-top-1 duration-200">
                    <div className="flex items-center gap-2 border-b border-slate-100 pb-2 mb-3">
                      <Settings2 className="h-4 w-4 text-blue-500" />
                      <span className="text-[9px] font-black uppercase tracking-wider text-slate-600">Configuração de Visibilidade das Colunas no CSV</span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3">
                      {DEFAULT_COLUMNS.map((col) => (
                        <div key={col.key} className="flex items-center gap-2 hover:bg-slate-50 p-1.5 rounded-lg transition-colors">
                          <input 
                            type="checkbox"
                            id={`col_check_${col.key}`}
                            checked={columnVisibility[col.key] || false}
                            onChange={() => toggleColumnVisibility(col.key)}
                            className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-3.5 w-3.5 cursor-pointer"
                          />
                          <label htmlFor={`col_check_${col.key}`} className="text-[8px] font-extrabold text-slate-600 uppercase tracking-wide cursor-pointer select-none truncate">
                            {col.label}
                          </label>
                        </div>
                      ))}
                    </div>
                  </Card>
                )}

                {/* Tabela Principal */}
                <Card className="flex-1 border-slate-200 bg-white rounded-3xl overflow-hidden flex flex-col p-4 shadow-sm">
                  <div className="flex-1 overflow-auto scrollbar-thin scrollbar-thumb-slate-200">
                    {previewDataRows.length > 0 ? (
                      <table className="w-full border-collapse text-left text-xs">
                        <thead>
                          <tr className="border-b border-slate-200 bg-slate-50 sticky top-0">
                            {visibleHeaders.map((col) => (
                              <th key={col.key} className="p-3 font-black uppercase tracking-widest text-[9px] text-slate-500 whitespace-nowrap min-w-[150px] border-r border-slate-100 last:border-r-0">
                                {col.label}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {previewDataRows.map((row: any[], rowIdx: number) => (
                            <tr key={rowIdx} className="border-b border-slate-100 hover:bg-slate-50/40 transition-colors">
                              {DEFAULT_COLUMNS.map((col, cellIdx) => {
                                if (!columnVisibility[col.key]) return null;
                                const cellVal = row[cellIdx];
                                return (
                                  <td 
                                    key={col.key} 
                                    className="p-3 text-slate-600 max-w-[300px] truncate border-r border-slate-100/50 last:border-r-0"
                                    title={cellVal !== undefined && cellVal !== null ? String(cellVal) : ''}
                                  >
                                    {cellVal !== undefined && cellVal !== null ? String(cellVal) : ''}
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : (
                      <div className="h-full flex flex-col items-center justify-center text-slate-400 text-xs uppercase font-bold tracking-widest gap-2">
                        <Info className="h-5 w-5 text-slate-300" />
                        Nenhum registro corresponde ao filtro inserido.
                      </div>
                    )}
                  </div>
                </Card>
              </div>

              {/* Dropdown / Drop do CSV Preview */}
              <div className="shrink-0 border border-slate-200 rounded-2xl bg-white shadow-sm overflow-hidden transition-all">
                <button
                  onClick={() => setShowCsvPreview(!showCsvPreview)}
                  className="w-full flex items-center justify-between p-4 hover:bg-slate-50/50 transition-all font-black text-[10px] uppercase tracking-widest text-slate-600 border-b border-transparent data-[open=true]:border-slate-200"
                  data-open={showCsvPreview}
                >
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-blue-500" />
                    <span>Visualizar código CSV gerado</span>
                  </div>
                  <div className="flex items-center gap-3">
                    {showCsvPreview ? (
                      <ChevronUp className="h-4 w-4 text-slate-400" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-slate-400" />
                    )}
                  </div>
                </button>

                {showCsvPreview && (
                  <div className="p-4 bg-slate-950 flex flex-col gap-3 animate-in fade-in slide-in-from-top-1 duration-250">
                    <div className="flex items-center justify-between shrink-0">
                      <span className="text-[8px] font-extrabold text-slate-500 uppercase tracking-widest">Estrutura CSV (RFC 4180)</span>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={handleCopyToClipboard} 
                        className="h-7 rounded-lg text-[9px] font-black text-blue-400 hover:text-white hover:bg-slate-900 px-3"
                      >
                        {copied ? (
                          <>
                            <Check className="h-3.5 w-3.5 mr-1.5 text-green-500" /> COPIADO!
                          </>
                        ) : (
                          <>
                            <Copy className="h-3.5 w-3.5 mr-1.5" /> COPIAR
                          </>
                        )}
                      </Button>
                    </div>
                    <pre className="h-32 overflow-auto font-mono text-[9px] leading-relaxed text-blue-300 selection:bg-blue-500/30 p-2 scrollbar-thin scrollbar-thumb-slate-800">
                      {getProcessedCsv()}
                    </pre>
                  </div>
                )}
              </div>

              {/* Bottom Download & Reset Panel */}
              <div className="flex items-center gap-4 shrink-0 animate-in slide-in-from-bottom-2 duration-300">
                <Button 
                  onClick={handleDownload}
                  className="flex-1 h-14 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-black uppercase tracking-[0.3em] text-[11px] shadow-md gap-3 transition-all active:scale-[0.98]"
                >
                  <Download className="h-4 w-4" /> Baixar Arquivo CSV
                </Button>
              </div>

            </div>
          )}

        </div>
      </main>
      
      {/* Tip bar */}
      <div className="px-8 py-3 bg-white border-t border-slate-200 flex items-center gap-3 shrink-0">
         <Zap className="h-4 w-4 text-amber-500 animate-pulse shrink-0" />
         <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
           Dica: O download gera um CSV codificado com UTF-8 BOM, ideal para abrir acentuações nativas em português diretamente no Microsoft Excel sem desconfigurar.
         </p>
      </div>
    </div>
  );
}

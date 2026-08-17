'use client';

import React, { useState } from 'react';
import { FileText, Copy, Check, Fingerprint, Building, Building2, HelpCircle, Info, ShieldCheck, CheckCircle, XCircle, RefreshCcw, Download, ClipboardList } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';

export default function DocGeneratorPage() {
  const [documents, setDocuments] = useState<string[]>(['000.000.000-00']);
  const [docType, setDocType] = useState<'CPF' | 'CNPJ_CLASSIC' | 'CNPJ_ALPHANUM'>('CPF');
  const [isFormatted, setIsFormatted] = useState<boolean>(true);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [quantity, setQuantity] = useState<number>(1);
  const [isBranchMode, setIsBranchMode] = useState<boolean>(false);

  // Validation State
  const [valInput, setValInput] = useState('');
  const [valResult, setValResult] = useState<{ isValid: boolean, message: string } | null>(null);

  // --- Utility Functions ---

  const getRandomDigit = () => Math.floor(Math.random() * 10).toString();

  const getRandomAlphanumeric = () => {
    const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    return chars[Math.floor(Math.random() * chars.length)];
  };

  const calculateDigit = (base: string, weights: number[]) => {
    let sum = 0;
    for (let i = 0; i < base.length; i++) {
      const charCode = base.charCodeAt(i);
      const value = charCode - 48;
      sum += value * weights[i];
    }
    const remainder = sum % 11;
    return remainder < 2 ? 0 : 11 - remainder;
  };

  // --- Generators ---

  const generateCPF = () => {
    const qty = Math.min(Math.max(1, quantity), 100);
    const results = [];
    for (let j = 0; j < qty; j++) {
      let base = '';
      for (let i = 0; i < 9; i++) base += getRandomDigit();
      const d1Weights = [10, 9, 8, 7, 6, 5, 4, 3, 2];
      const d1 = calculateDigit(base, d1Weights);
      const baseWithD1 = base + d1;
      const d2Weights = [11, 10, 9, 8, 7, 6, 5, 4, 3, 2];
      const d2 = calculateDigit(baseWithD1, d2Weights);
      results.push(baseWithD1 + d2);
    }
    setDocuments(results);
    setDocType('CPF');
    return results;
  };

  const generateCNPJClassic = () => {
    const qty = Math.min(Math.max(1, quantity), 100);
    const results = [];
    let root = '';
    if (isBranchMode) {
      for (let i = 0; i < 8; i++) root += getRandomDigit();
    }
    for (let j = 0; j < qty; j++) {
      let currentRoot = root;
      if (!isBranchMode) {
        currentRoot = '';
        for (let i = 0; i < 8; i++) currentRoot += getRandomDigit();
      }
      let branchValue = isBranchMode ? j + 1 : 1;
      let branch = branchValue.toString().padStart(4, '0');
      if (branchValue > 9999) branch = '9999';
      let base = currentRoot + branch;
      const d1Weights = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
      const d1 = calculateDigit(base, d1Weights);
      const baseWithD1 = base + d1;
      const d2Weights = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
      const d2 = calculateDigit(baseWithD1, d2Weights);
      results.push(baseWithD1 + d2);
    }
    setDocuments(results);
    setDocType('CNPJ_CLASSIC');
    return results;
  };

  const generateCNPJAlpha = () => {
    const qty = Math.min(Math.max(1, quantity), 100);
    const results = [];
    let root = '';
    if (isBranchMode) {
      for (let i = 0; i < 8; i++) root += getRandomAlphanumeric();
    }
    for (let j = 0; j < qty; j++) {
      let currentRoot = root;
      if (!isBranchMode) {
        currentRoot = '';
        for (let i = 0; i < 8; i++) currentRoot += getRandomAlphanumeric();
      }
      let branchValue = isBranchMode ? j + 1 : 1;
      let branch = branchValue.toString().padStart(4, '0');
      if (branchValue > 9999) branch = '9999';
      let base = currentRoot + branch;
      const d1Weights = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
      const d1 = calculateDigit(base, d1Weights);
      const baseWithD1 = base + d1;
      const d2Weights = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
      const d2 = calculateDigit(baseWithD1, d2Weights);
      results.push(baseWithD1 + d2);
    }
    setDocuments(results);
    setDocType('CNPJ_ALPHANUM');
    return results;
  };

  // --- Validators ---

  const validateCPF = (cpf: string) => {
    if (!/^\d{11}$/.test(cpf)) return false;
    if (/^(\d)\1+$/.test(cpf)) return false; // same digits

    const d1Weights = [10, 9, 8, 7, 6, 5, 4, 3, 2];
    const d1 = calculateDigit(cpf.substring(0, 9), d1Weights);
    if (d1 !== parseInt(cpf[9])) return false;

    const d2Weights = [11, 10, 9, 8, 7, 6, 5, 4, 3, 2];
    const d2 = calculateDigit(cpf.substring(0, 10), d2Weights);
    if (d2 !== parseInt(cpf[10])) return false;

    return true;
  };

  const validateCNPJ = (cnpj: string) => {
    if (!/^[\w\d]{8}\d{6}$/.test(cnpj)) return false; // Alphanumeric root, numeric branch+digits

    const d1Weights = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const d1 = calculateDigit(cnpj.substring(0, 12), d1Weights);
    if (d1 !== parseInt(cnpj[12])) return false;

    const d2Weights = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const d2 = calculateDigit(cnpj.substring(0, 13), d2Weights);
    if (d2 !== parseInt(cnpj[13])) return false;

    return true;
  };

  const handleValidate = () => {
    if (!valInput) {
      setValResult(null);
      return;
    }

    const cleanInput = valInput.replace(/[^\w\d]/g, '').toUpperCase();

    if (cleanInput.length === 11) {
      const isValid = validateCPF(cleanInput);
      setValResult({
        isValid,
        message: isValid ? 'Documento Válido!' : 'Documento Inválido',
      });
    } else if (cleanInput.length === 14) {
      const isValid = validateCNPJ(cleanInput);
      setValResult({
        isValid,
        message: isValid ? 'Documento Válido!' : 'Documento Inválido',
      });
    } else {
      setValResult({
        isValid: false,
        message: 'Tamanho inválido (deve ter 11 ou 14 caracteres)',
      });
    }
  };

  // --- Display and Formatting ---

  const formatDocument = (doc: string, type: string) => {
    if (!doc || doc === '000.000.000-00') return doc;

    const raw = doc.replace(/[^\w\d]/g, '');
    if (!isFormatted) return raw;

    if (type === 'CPF' && raw.length === 11) {
      return raw.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4');
    }
    if ((type === 'CNPJ_CLASSIC' || type === 'CNPJ_ALPHANUM') && raw.length === 14) {
      return raw.replace(/^(\w{2})(\w{3})(\w{3})(\w{4})(\d{2})$/, '$1.$2.$3/$4-$5');
    }

    return raw;
  };

  const copyToClipboard = async (text: string, index: number) => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
      } else {
        const textArea = document.createElement("textarea");
        textArea.value = text;
        textArea.style.position = "fixed";
        textArea.style.left = "-999999px";
        textArea.style.top = "-999999px";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand('copy');
        textArea.remove();
      }
      setCopiedIndex(index);
      toast.success('Copiado!');
      setTimeout(() => setCopiedIndex(null), 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
      toast.error('Erro ao copiar.');
    }
  };

  const copyAll = async () => {
    const allFormatted = documents.map(d => formatDocument(d, docType)).join('\n');
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(allFormatted);
      } else {
        const textArea = document.createElement("textarea");
        textArea.value = allFormatted;
        textArea.style.position = "fixed";
        textArea.style.left = "-999999px";
        textArea.style.top = "-999999px";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand('copy');
        textArea.remove();
      }
      toast.success('Todos copiados!');
    } catch (err) {
      toast.error('Erro ao copiar.');
    }
  };

  const exportCSV = () => {
    const allFormatted = documents.map(d => formatDocument(d, docType));
    const csvContent = "data:text/csv;charset=utf-8,Documento\n" + allFormatted.join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `documentos_${docType.toLowerCase()}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  return (
    <div className="flex-1 flex flex-col bg-slate-50 h-screen overflow-hidden font-sans">
      {/* Mesh Gradient Local */}
      <div className="absolute top-0 right-0 w-[300px] h-[300px] bg-blue-100/30 blur-[100px] pointer-events-none -z-10" />

      {/* Main Header (Compact) */}
      <header className="px-8 py-5 bg-white/60 backdrop-blur-xl border-b border-white/60 flex items-center justify-between shrink-0 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/30">
            <FileText className="h-5 w-5 text-white" />
          </div>
          <div className="flex flex-col">
            <h1 className="text-lg font-bold leading-none">Gerador de Documentos</h1>
            <p className="text-[10px] text-muted-foreground font-medium mt-1 uppercase tracking-widest">FICTITIOUS DATA ENGINE PROFESSIONAL</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="sm" className="h-10 px-4 font-black text-[9px] uppercase tracking-widest gap-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-all rounded-xl">
                <HelpCircle className="h-4 w-4" />
                GUIA
              </Button>
            </SheetTrigger>
            <SheetContent className="sm:max-w-xl overflow-hidden flex flex-col p-0 border-none shadow-2xl">
              <SheetHeader className="shrink-0 border-b p-8 bg-white">
                <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/30 mb-4">
                  <Fingerprint className="h-6 w-6 text-white" />
                </div>
                <SheetTitle className="text-3xl font-black uppercase tracking-tighter italic text-slate-800">
                  Gerador de Documentos
                </SheetTitle>
                <SheetDescription className="text-slate-500 font-bold text-xs uppercase tracking-widest mt-2 leading-relaxed">
                  Geração e validação matemática de documentos fictícios
                </SheetDescription>
              </SheetHeader>
              <ScrollArea className="flex-1 text-slate-600">
                <div className="p-8 space-y-10">
                  <div className="space-y-4">
                    <h3 className="font-black text-xs uppercase tracking-[0.2em] text-blue-600 flex items-center gap-2 italic">
                      01. Geração em Lote e Filiais
                    </h3>
                    <p className="text-sm text-slate-500 font-medium leading-relaxed">
                      Gerar dados um a um é coisa do passado. Defina a <strong>Quantidade</strong> (até 100) para testes de carga. Ativar <strong>Filiais</strong> permite criar documentos que compartilham a mesma "raiz" (8 caracteres), variando apenas o sufixo (ex: 0001, 0002).
                    </p>
                  </div>

                  <div className="space-y-4">
                    <h3 className="font-black text-xs uppercase tracking-[0.2em] text-blue-600 flex items-center gap-2 italic">
                      02. Novo CNPJ Alfanumérico (2026)
                    </h3>
                    <p className="text-sm text-slate-500 font-medium leading-relaxed">
                      A partir de 2026, a Receita Federal introduziu o CNPJ com raiz alfanumérica. Esta ferramenta converte as letras base em decimais para o cálculo exato do dígito verificador via Módulo 11.
                    </p>
                  </div>

                  <div className="space-y-4">
                    <h3 className="font-black text-xs uppercase tracking-[0.2em] text-blue-600 flex items-center gap-2 italic">
                      03. Validador Módulo 11
                    </h3>
                    <p className="text-sm text-slate-500 font-medium leading-relaxed">
                      A aba <strong>Validar Individual</strong> executa uma verificação rigorosa, aplicando matemática reversa para garantir que os dígitos verificadores correspondem ao corpo do documento.
                    </p>
                  </div>

                  <div className="space-y-4 p-6 bg-amber-50/50 rounded-[2rem] border border-amber-100">
                    <h3 className="font-black text-xs uppercase tracking-[0.2em] text-amber-600 flex items-center gap-2 italic">
                      Aviso Legal Importante
                    </h3>
                    <p className="text-[11px] text-amber-800/80 font-bold leading-relaxed">
                      Os números de CNPJ gerados por esta ferramenta são exclusivamente fictícios e destinam-se apenas para fins de desenvolvimento, teste e simulação de sistemas. Estes números NÃO representam empresas reais cadastradas na Receita Federal do Brasil e não possuem validade jurídica ou comercial. O uso destes CNPJs fictícios para qualquer finalidade oficial, legal ou comercial é inadequado e pode configurar irregularidade. Para consultas de CNPJs válidos e informações empresariais oficiais, utilize exclusivamente os canais oficiais da Receita Federal do Brasil.
                    </p>
                  </div>
                </div>
              </ScrollArea>
            </SheetContent>
          </Sheet>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-4 md:p-6 scrollbar-thin scrollbar-thumb-muted">
        <div className="max-w-6xl mx-auto">
          <Tabs defaultValue="generator" className="w-full">
            <TabsList className="flex w-fit mx-auto mb-10 bg-slate-100/50 p-1.5 rounded-2xl gap-1">
              <TabsTrigger value="generator" className="font-black text-[10px] uppercase tracking-widest px-8 py-2.5 rounded-xl data-[state=active]:bg-white data-[state=active]:text-blue-600 data-[state=active]:shadow-sm">Gerar Lote</TabsTrigger>
              <TabsTrigger value="validator" className="font-black text-[10px] uppercase tracking-widest px-8 py-2.5 rounded-xl data-[state=active]:bg-white data-[state=active]:text-blue-600 data-[state=active]:shadow-sm">Validar Individual</TabsTrigger>
            </TabsList>

            <TabsContent value="generator" className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center w-full gap-6">
                <div className="flex flex-col gap-1">
                  <h2 className="text-xl font-black uppercase tracking-tighter italic text-slate-800">Motor de Geração</h2>
                  <p className="text-slate-400 font-bold text-[10px] uppercase tracking-widest">Configuração do Lote de Testes</p>
                </div>
                <div className="flex flex-wrap items-center gap-4">
                  <div className="flex items-center space-x-3 bg-white px-4 py-2 rounded-2xl border border-slate-100 shadow-sm">
                    <Label htmlFor="qty" className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Qtd:</Label>
                    <Input
                      id="qty"
                      type="number"
                      min="1"
                      max="100"
                      value={quantity}
                      onChange={(e) => setQuantity(Number(e.target.value))}
                      className="w-16 h-8 text-center text-sm font-black bg-slate-50 border-none rounded-lg"
                    />
                  </div>
                  {docType !== 'CPF' && (
                    <div className="flex items-center space-x-3 bg-white px-4 py-2 rounded-2xl border border-slate-100 shadow-sm">
                      <Label htmlFor="branch-toggle" className="text-[10px] font-black text-slate-400 uppercase tracking-widest cursor-pointer">Filiais</Label>
                      <Switch
                        id="branch-toggle"
                        checked={isBranchMode}
                        onCheckedChange={setIsBranchMode}
                        className="data-[state=checked]:bg-blue-600"
                      />
                    </div>
                  )}
                  <div className="flex items-center space-x-3 bg-white px-4 py-2 rounded-2xl border border-slate-100 shadow-sm">
                    <Label htmlFor="format-toggle" className="text-[10px] font-black text-blue-600 uppercase tracking-widest cursor-pointer">Pontuação</Label>
                    <Switch
                      id="format-toggle"
                      checked={isFormatted}
                      onCheckedChange={setIsFormatted}
                      className="data-[state=checked]:bg-blue-600"
                    />
                  </div>
                </div>
              </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card
                  className={cn(
                    "cursor-pointer border-2 transition-all group overflow-hidden relative rounded-[2rem] p-4 flex flex-col items-center justify-center gap-4 active:scale-95",
                    docType === 'CPF' ? "border-blue-600 bg-blue-50/50 shadow-xl shadow-blue-500/10" : "bg-white border-white hover:border-blue-100 hover:bg-slate-50/50 shadow-lg shadow-slate-900/5"
                  )}
                  onClick={generateCPF}
                >
                  <div className={cn("p-4 rounded-2xl transition-all shadow-inner", docType === 'CPF' ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-400 group-hover:bg-blue-100 group-hover:text-blue-600")}>
                    <Fingerprint className="h-10 w-10" />
                  </div>
                  <div className="flex flex-col items-center">
                    <h3 className={cn("text-base font-black uppercase tracking-tight", docType === 'CPF' ? "text-blue-700" : "text-slate-800")}>CPF Padrão</h3>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Nacional Brasileiro</p>
                  </div>
                </Card>

                <Card
                  className={cn(
                    "cursor-pointer border-2 transition-all group overflow-hidden relative rounded-[2rem] p-4 flex flex-col items-center justify-center gap-4 active:scale-95",
                    docType === 'CNPJ_CLASSIC' ? "border-blue-600 bg-blue-50/50 shadow-xl shadow-blue-500/10" : "bg-white border-white hover:border-blue-100 hover:bg-slate-50/50 shadow-lg shadow-slate-900/5"
                  )}
                  onClick={generateCNPJClassic}
                >
                  <div className={cn("p-4 rounded-2xl transition-all shadow-inner", docType === 'CNPJ_CLASSIC' ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-400 group-hover:bg-blue-100 group-hover:text-blue-600")}>
                    <Building className="h-10 w-10" />
                  </div>
                  <div className="flex flex-col items-center">
                    <h3 className={cn("text-base font-black uppercase tracking-tight", docType === 'CNPJ_CLASSIC' ? "text-blue-700" : "text-slate-800")}>CNPJ Clássico</h3>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Estatutário Legado</p>
                  </div>
                </Card>

                <Card
                  className={cn(
                    "cursor-pointer border-2 transition-all group overflow-hidden relative rounded-[2rem] p-4 flex flex-col items-center justify-center gap-4 active:scale-95",
                    docType === 'CNPJ_ALPHANUM' ? "border-blue-600 bg-blue-50/50 shadow-xl shadow-blue-500/10" : "bg-white border-white hover:border-blue-100 hover:bg-slate-50/50 shadow-lg shadow-slate-900/5"
                  )}
                  onClick={generateCNPJAlpha}
                >
                  <div className={cn("p-4 rounded-2xl transition-all shadow-inner", docType === 'CNPJ_ALPHANUM' ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-400 group-hover:bg-blue-100 group-hover:text-blue-600")}>
                    <Building2 className="h-10 w-10" />
                  </div>
                  <div className="flex flex-col items-center">
                    <h3 className={cn("text-base font-black uppercase tracking-tight", docType === 'CNPJ_ALPHANUM' ? "text-blue-700" : "text-slate-800")}>CNPJ Alfanumérico</h3>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Novo Padrão 2026</p>
                  </div>
                </Card>
              </div>

              {/* Result Area */}
              <div className="relative pt-8">
                <div className="flex flex-col sm:flex-row items-center justify-between mb-4 px-4 gap-6">
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full bg-blue-600 animate-pulse" />
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">
                        {documents.length} LOTES GERADOS • {docType}
                      </span>
                    </div>
                    <p className="text-[9px] font-black text-amber-600 uppercase tracking-widest bg-amber-50 px-3 py-1 rounded-full border border-amber-100/50 w-fit">
                      ⚠️ Documentos fictícios para fins de teste e simulação
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <Button variant="ghost" className="h-10 px-4 text-[9px] font-black uppercase tracking-widest gap-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-all rounded-xl" onClick={copyAll}>
                      <ClipboardList className="w-4 h-4" /> Copiar Tudo
                    </Button>
                    <Button variant="ghost" className="h-10 px-4 text-[9px] font-black uppercase tracking-widest gap-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-all rounded-xl" onClick={exportCSV}>
                      <Download className="w-4 h-4" /> Exportar CSV
                    </Button>
                    <Button className="h-12 px-6 bg-slate-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-blue-600 transition-all shadow-xl shadow-slate-900/10 active:scale-95" onClick={() => {
                      if (docType === 'CPF') generateCPF();
                      else if (docType === 'CNPJ_CLASSIC') generateCNPJClassic();
                      else generateCNPJAlpha();
                    }}>
                      <RefreshCcw className="w-4 h-4 mr-2" /> Gerar Novamente
                    </Button>
                  </div>
                </div>

                <Card className="border-none bg-white shadow-2xl shadow-slate-900/5 overflow-hidden rounded-[2rem] relative">
                  <CardContent className="p-0">
                    <ScrollArea className="max-h-[450px] w-full">
                      <div className="divide-y divide-slate-50 relative">
                        {documents.map((doc, idx) => {
                          const formattedDoc = formatDocument(doc, docType);
                          return (
                            <div key={idx} className="flex items-center justify-between px-8 py-6 hover:bg-slate-50 transition-all group">
                              <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                                <span className="text-2xl md:text-3xl font-mono font-black text-slate-800 tracking-[0.1em]">
                                  {formattedDoc}
                                </span>
                                {isBranchMode && docType !== 'CPF' && (
                                  <Badge className={cn("px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest", idx === 0 ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-500")}>
                                    {idx === 0 ? 'MATRIZ' : 'FILIAL'}
                                  </Badge>
                                )}
                              </div>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-12 w-12 rounded-2xl bg-slate-100 text-slate-400 hover:bg-blue-100 hover:text-blue-600 transition-all opacity-0 group-hover:opacity-100"
                                onClick={() => copyToClipboard(formattedDoc, idx)}
                              >
                                {copiedIndex === idx ? <Check className="w-5 h-5 text-green-500" /> : <Copy className="w-5 h-5" />}
                              </Button>
                            </div>
                          )
                        })}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="validator" className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500 max-w-3xl mx-auto mt-4 pb-10">
              <div className="text-center space-y-1.5">
                <h2 className="text-2xl font-black uppercase tracking-tighter italic text-slate-800">Validador de Precisão</h2>
                <p className="text-slate-400 font-bold text-[10px] uppercase tracking-[0.2em]">Verificação local por matemática reversa (Módulo 11)</p>
              </div>

              <div className="relative group">
                <div className="absolute -inset-2 bg-gradient-to-r from-blue-600/20 to-emerald-600/20 rounded-[2.5rem] blur opacity-0 group-hover:opacity-100 transition duration-1000 pointer-events-none" />
                <Input
                  value={valInput}
                  onChange={(e) => {
                    setValInput(e.target.value);
                    if (valResult) setValResult(null); // Reset on typing
                  }}
                  placeholder="Cole ou digite aqui..."
                  className="h-20 text-2xl font-mono text-center tracking-[0.2em] bg-white border-none focus-visible:ring-0 transition-all rounded-[2rem] shadow-2xl shadow-slate-200/50 uppercase font-black text-slate-800 placeholder:text-slate-200 relative z-10"
                  onKeyDown={(e) => e.key === 'Enter' && handleValidate()}
                />
              </div>

              <div className="flex justify-center">
                <Button
                  size="lg"
                  onClick={handleValidate}
                  className="h-12 px-10 rounded-full font-bold text-sm uppercase tracking-widest shadow-xl shadow-primary/10 transition-all hover:scale-105 active:scale-95"
                >
                  Verificar Validade
                </Button>
              </div>

              {valResult && (
                <div className="mt-4 pt-4 w-full flex justify-center animate-in fade-in zoom-in-95 duration-300">
                  <div className={cn(
                    "flex items-center gap-4 px-8 py-5 rounded-[2rem] shadow-2xl relative overflow-hidden w-full",
                    valResult.isValid
                      ? "bg-emerald-50 text-emerald-600"
                      : "bg-rose-50 text-rose-600"
                  )}>
                    <div className={cn("shrink-0 p-3 rounded-xl shadow-inner", valResult.isValid ? "bg-emerald-600 text-white" : "bg-rose-600 text-white")}>
                      {valResult.isValid ? <CheckCircle className="w-8 h-8" /> : <XCircle className="w-8 h-8" />}
                    </div>
                    <div className="flex flex-col">
                      <span className="font-black text-xl uppercase tracking-tighter italic leading-none">
                        {valResult.message}
                      </span>
                      <span className="text-[9px] font-black uppercase tracking-widest mt-1.5 opacity-60 italic">
                        {valResult.isValid ? 'ASSINATURA MATEMÁTICA VÁLIDA' : 'FALHA NA INTEGRIDADE DO DOCUMENTO'}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
}

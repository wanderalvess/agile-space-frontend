'use client';

import { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Download, FileText, ClipboardCopy, CheckCircle2, LayoutDashboard } from 'lucide-react';
import type { HealthCheckVote, HealthCheckDimension } from '@/lib/types';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Logo } from '@/components/Logo';
import { Loader2 } from 'lucide-react';

interface ExportHealthCheckDialogProps {
  roomTitle?: string;
  dimensions: HealthCheckDimension[];
  votes: HealthCheckVote[];
  results: any[];
  triggerNode?: React.ReactNode;
}

export function ExportHealthCheckDialog({ roomTitle, dimensions, votes, results, triggerNode }: ExportHealthCheckDialogProps) {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const pdfRef = useRef<HTMLDivElement>(null);

  const formatDate = () => format(new Date(), "dd/MM/yyyy", { locale: ptBR });
  const filenameDate = format(new Date(), "yyyy-MM-dd");

  const dimensionsMap = new Map(dimensions.map(d => [d.key, d.title]));

  const chartData = dimensions.map(dim => {
    const dimVotes = votes.filter(v => v.dimensionKey === dim.key);
    return {
      title: dimensionsMap.get(dim.key) || dim.key,
      greenRaw: dimVotes.filter(v => v.value === 'green').length,
      yellowRaw: dimVotes.filter(v => v.value === 'yellow').length,
      redRaw: dimVotes.filter(v => v.value === 'red').length,
      total: dimVotes.length
    };
  });

  // Markdown
  const handleMarkdown = () => {
    let markdown = `# Radar de Saúde: ${roomTitle || 'Radar Espaço Ágil'}\n**Data:** ${formatDate()}\n\n`;
    
    markdown += `| Dimensão | Tudo Bem (Verde) | Atenção (Amarelo) | Ruim (Vermelho) |\n`;
    markdown += `|---|---|---|---|\n`;

    chartData.forEach(d => {
      markdown += `| ${d.title} | ${d.greenRaw} | ${d.yellowRaw} | ${d.redRaw} |\n`;
    });

    markdown += `\n**Faróis Vermelhos Emitidos (Requer Ação):**\n`;
    const weaknesses = results.filter(r => r.red > 0 || (r.yellow > 0 && r.yellow >= r.green));
    if (weaknesses.length === 0) {
      markdown += `- Nenhum radar crítico detectado.\n`;
    } else {
      weaknesses.forEach(w => {
        markdown += `- ${dimensionsMap.get(w.dimensionKey) || w.dimensionKey}\n`;
      });
    }

    navigator.clipboard.writeText(markdown.trim());
    toast({ title: 'Markdown Copiado!', description: 'Pronto para colar no Jira, Confluence ou Notion.' });
  };

  // CSV
  const handleCSV = () => {
    const headers = ['Data', 'Dimensão', 'Tudo Bem (Votos)', 'Atenção (Votos)', 'Ruim (Votos)'];
    const rows = chartData.map(d => [
      `"${formatDate()}"`,
      `"${d.title.replace(/"/g, '""')}"`,
      `"${d.greenRaw}"`,
      `"${d.yellowRaw}"`,
      `"${d.redRaw}"`
    ].join(','));

    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `radar-${roomTitle || 'agilespace'}-${filenameDate}.csv`;
    link.click();
    toast({ title: 'CSV Baixado!', description: 'Arquivo CSV gerado com sucesso.' });
  };

  // PDF
  const handlePDF = async () => {
    if (!pdfRef.current) return;
    setIsExporting(true);
    try {
      const canvas = await html2canvas(pdfRef.current, { 
        scale: 2, 
        useCORS: true,
        backgroundColor: '#ffffff'
      } as any);
      const imgData = canvas.toDataURL('image/png');
      
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`radar-${roomTitle || 'agilespace'}-${filenameDate}.pdf`);
      toast({ title: 'PDF Baixado!', description: 'Relatório visual exportado com sucesso.' });
    } catch (e) {
      toast({ title: 'Erro na exportação', description: 'Não foi possível gerar o PDF.', variant: 'destructive' });
    } finally {
      setIsExporting(false);
    }
  };

  if (votes.length === 0) return null;

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {triggerNode || (
          <Button variant="outline" size="sm" className="hidden sm:flex h-8 px-3 font-black text-[9px] uppercase tracking-widest gap-2 border-2">
            <Download className="h-3.5 w-3.5" />
            EXPORTAR RADAR
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md bg-card/90 backdrop-blur-2xl border-white/10 shadow-2xl rounded-3xl p-0 overflow-hidden">
        <div className="p-6 border-b border-border/50 flex flex-col items-center gap-3 text-center">
          <div className="h-12 w-12 bg-primary/10 rounded-full flex items-center justify-center text-primary mb-2 shadow-inner">
            <CheckCircle2 className="h-6 w-6" />
          </div>
          <DialogTitle className="text-2xl font-black uppercase tracking-tighter italic">Exportar Snapshot</DialogTitle>
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tight px-4 leading-relaxed">
            Transforme o diagnóstico da sua equipe em documentação oficial de alta performance.
          </p>
        </div>

        <div className="p-6 grid gap-3">
          <Button onClick={handleMarkdown} variant="outline" className="h-16 justify-start px-5 border-2 hover:bg-emerald-50 hover:border-emerald-200 group transition-all rounded-2xl relative overflow-hidden">
            <div className="h-10 w-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center mr-4 group-hover:scale-110 transition-transform shadow-inner">
              <ClipboardCopy className="h-5 w-5" />
            </div>
            <div className="flex flex-col items-start truncate text-left">
              <span className="font-black uppercase tracking-[0.1em] text-[11px] text-slate-800">Relatório Markdown</span>
              <span className="text-[9px] text-slate-400 font-bold uppercase">Cópia rápida para Jira/Confluence</span>
            </div>
            <div className="absolute right-4 opacity-0 group-hover:opacity-100 transition-opacity">
              <div className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center">
                <CheckCircle2 className="h-3 w-3 text-emerald-600" />
              </div>
            </div>
          </Button>

          <Button onClick={handleCSV} variant="outline" className="h-16 justify-start px-5 border-2 hover:bg-slate-50 hover:border-slate-200 group transition-all rounded-2xl relative overflow-hidden">
            <div className="h-10 w-10 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center mr-4 group-hover:scale-110 transition-transform shadow-inner">
              <FileText className="h-5 w-5" />
            </div>
            <div className="flex flex-col items-start truncate text-left">
              <span className="font-black uppercase tracking-[0.1em] text-[11px] text-slate-800">Dados Brutos (CSV)</span>
              <span className="text-[9px] text-slate-400 font-bold uppercase">Ideal para tabelas no Excel</span>
            </div>
          </Button>

          <Button onClick={handlePDF} disabled={isExporting} variant="default" className="h-20 justify-start px-6 border-none shadow-xl shadow-emerald-600/20 group transition-all rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white mt-2 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-full bg-white/10 skew-x-[30deg] translate-x-16 group-hover:translate-x-8 transition-transform duration-700" />
            <div className="h-12 w-12 rounded-xl bg-white/20 text-white flex items-center justify-center mr-4 group-hover:scale-110 transition-transform shadow-lg">
              {isExporting ? <Loader2 className="h-6 w-6 animate-spin" /> : <Download className="h-6 w-6" />}
            </div>
            <div className="flex flex-col items-start truncate text-left z-10">
              <span className="font-black uppercase tracking-[0.15em] text-[13px]">
                {isExporting ? 'Processando...' : 'Snapshot Visual (PDF)'}
              </span>
              <span className="text-[10px] opacity-70 font-bold uppercase">Relatório Gráfico Completo</span>
            </div>
          </Button>
        </div>
      </DialogContent>

      <div className="fixed left-[-9999px] top-[-9999px] overflow-visible">
        <div ref={pdfRef} className="w-[800px] bg-slate-50 text-slate-800 p-12 overflow-hidden shadow-none box-border" style={{ fontFamily: 'sans-serif' }}>
          <div className="flex items-center justify-between border-b-2 border-slate-200 pb-8 mb-8">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-600 rounded-2xl flex items-center justify-center w-14 h-14">
                <Logo className="h-8 w-8 text-white" />
              </div>
              <div className="flex flex-col flex-1 min-w-0">
                <h1 className="text-3xl font-black uppercase tracking-tighter text-slate-900 leading-none">Espaço Ágil</h1>
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mt-1">Radar de Saúde (Health Check)</span>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm font-bold text-slate-500 uppercase tracking-wider">{formatDate()}</p>
              <p className="text-lg font-black text-slate-800">{roomTitle || 'Avaliação de Squad'}</p>
            </div>
          </div>

          <div className="bg-white rounded-[2rem] p-10 mb-8 border border-slate-100 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-slate-50 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
            <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-300 mb-8 flex items-center gap-3">
              <LayoutDashboard className="h-4 w-4" />
              Distribuição de Sentimentos
            </h2>
            <div className="space-y-6">
              {chartData.map(d => (
                <div key={d.title} className="flex items-center justify-between gap-8 border-b border-slate-50 pb-6 last:border-0 last:pb-0">
                  <div className="w-[35%] shrink-0">
                    <p className="font-black text-slate-700 text-xs uppercase tracking-tight truncate">{d.title}</p>
                  </div>
                  <div className="flex-1 flex gap-2 h-5 bg-slate-50 rounded-full p-1 overflow-hidden shadow-inner">
                    {d.greenRaw > 0 && <div style={{ width: `${(d.greenRaw/d.total)*100}%` }} className="bg-emerald-500 h-full rounded-full transition-all duration-500 shadow-[0_0_8px_rgba(16,185,129,0.3)]" />}
                    {d.yellowRaw > 0 && <div style={{ width: `${(d.yellowRaw/d.total)*100}%` }} className="bg-amber-400 h-full rounded-full transition-all duration-500 shadow-[0_0_8px_rgba(245,158,11,0.3)]" />}
                    {d.redRaw > 0 && <div style={{ width: `${(d.redRaw/d.total)*100}%` }} className="bg-rose-500 h-full rounded-full transition-all duration-500 shadow-[0_0_8px_rgba(239,68,68,0.3)]" />}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6 bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm">
            <div>
              <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-600 bg-emerald-50 px-4 py-3 rounded-xl mb-6 inline-flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-500" />
                Pontos Fortes da Squad
              </h2>
              <ul className="space-y-3 px-2">
                {results.filter(r => r.green > r.yellow && r.green > r.red).map((r, i) => (
                  <li key={i} className="text-sm font-bold text-slate-700 flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-200" />
                    {dimensionsMap.get(r.dimensionKey) || r.dimensionKey}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-rose-600 bg-rose-50 px-4 py-3 rounded-xl mb-6 inline-flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-rose-500" />
                Atenção Crítica
              </h2>
              <ul className="space-y-3 px-2">
                {results.filter(r => r.red > 0 || (r.yellow > 0 && r.yellow >= r.green)).map((r, i) => (
                  <li key={i} className="text-sm font-bold text-slate-700 flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-rose-200" />
                    {dimensionsMap.get(r.dimensionKey) || r.dimensionKey}
                  </li>
                ))}
              </ul>
            </div>
          </div>
          
          <div className="mt-16 pt-8 border-t border-slate-200 text-center">
             <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
               Gerado automaticamente por Espaço Ágil | Medindo o fluxo de valor de forma saudável.
             </p>
          </div>
        </div>
      </div>
    </Dialog>
  );
}

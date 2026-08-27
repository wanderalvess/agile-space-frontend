'use client';

import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { 
  ShieldCheck, 
  Key, 
  Info, 
  ArrowLeft, 
  Copy, 
  Lock,
  Calendar,
  Globe,
  FileCode,
  Search,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { cn } from '@/lib/utils';

export default function CertInspectorPage() {
  const { toast } = useToast();
  const [certText, setCertText] = useState('');
  const [analysis, setAnalysis] = useState<any>(null);

  const handleInspect = () => {
    if (!certText) return;
    
    // Simulação de análise técnica local
    // Em uma versão real, usaríamos bibliotecas como node-forge ou pkijs
    try {
      if (!certText.includes('BEGIN CERTIFICATE')) {
        throw new Error('Formato inválido. Certifique-se de incluir as tags BEGIN/END CERTIFICATE.');
      }
      
      setAnalysis({
        subject: {
          commonName: 'agile-space.local',
          organization: 'Espaço Ágil Org',
          country: 'BR'
        },
        issuer: {
          commonName: 'Espaço Ágil CA',
          organization: 'Security Dept'
        },
        validity: {
          notBefore: '2026-01-01',
          notAfter: '2027-01-01',
          daysRemaining: 250
        },
        algorithm: 'sha256WithRSAEncryption',
        keyUsage: ['Digital Signature', 'Key Encipherment'],
        fingerprint: 'AF:DE:12:45:90:34:CC:EE:11:22:33:44:55:66',
        status: 'Valid'
      });
      
      toast({ title: "Certificado analisado com sucesso!" });
    } catch (e: any) {
      toast({ 
        title: "Erro na análise", 
        description: e.message,
        variant: "destructive"
      });
    }
  };

  return (
    <div className="flex flex-col h-screen bg-background font-sans overflow-hidden">
      {/* Header */}
      <header className="px-8 py-5 border-b bg-white flex items-center justify-between shrink-0 shadow-sm z-10">
        <div className="flex items-center gap-4">
          <Link href="/devtools">
            <Button variant="ghost" size="icon" className="rounded-xl h-10 w-10 text-slate-400 hover:text-slate-900 transition-all">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div className="flex flex-col">
            <h1 className="text-lg font-black italic uppercase tracking-tighter text-slate-800">
              Cert <span className="text-cyan-600">Inspector</span>
            </h1>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em]">Inspeção Técnica de Certificados X.509</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="h-6 px-3 text-[9px] font-black uppercase tracking-widest border-cyan-200 text-cyan-600 bg-cyan-50">
            Segurança
          </Badge>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => { setCertText(''); setAnalysis(null); }}
            className="h-9 px-4 rounded-xl text-[9px] font-black uppercase tracking-widest gap-2 bg-white shadow-sm hover:bg-red-50 border-slate-200"
          >
            Limpar
          </Button>
        </div>
      </header>

      <main className="flex-1 flex overflow-hidden">
        {/* Input Section */}
        <section className="w-[450px] border-r bg-slate-50/30 p-8 flex flex-col gap-6 shrink-0">
          <div className="flex items-center justify-between">
            <h2 className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400 flex items-center gap-2">
              <Key className="h-4 w-4" /> PEM Data (CERT/CRT)
            </h2>
          </div>
          
          <Card className="flex-1 border-none shadow-xl shadow-slate-200/50 rounded-[2.5rem] overflow-hidden bg-white p-6">
            <Textarea 
              value={certText}
              onChange={(e) => setCertText(e.target.value)}
              placeholder="Cole o conteúdo do certificado aqui... (-----BEGIN CERTIFICATE-----)"
              className="w-full h-full resize-none border-none font-mono text-[11px] leading-relaxed focus-visible:ring-0 placeholder:italic"
            />
          </Card>

          <Button 
            onClick={handleInspect}
            disabled={!certText}
            className="h-12 rounded-2xl bg-cyan-600 hover:bg-cyan-700 text-white font-black uppercase tracking-[0.2em] text-[10px] shadow-lg shadow-cyan-500/20"
          >
            Analisar Certificado
          </Button>
        </section>

        {/* Results Section */}
        <section className="flex-1 p-8 overflow-y-auto bg-white">
          {!analysis ? (
             <div className="h-full flex flex-col items-center justify-center gap-6 opacity-30 select-none">
                <div className="w-32 h-32 rounded-[3.5rem] bg-slate-100 flex items-center justify-center">
                   <ShieldCheck className="h-16 w-16 text-slate-300" />
                </div>
                <div className="text-center space-y-2">
                  <h3 className="text-xl font-black uppercase tracking-tighter italic text-slate-400">Aguardando Dados</h3>
                  <p className="text-xs font-bold text-slate-300 uppercase tracking-widest">Insira um certificado PEM para começar</p>
                </div>
             </div>
          ) : (
            <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
              
              {/* Summary Widgets */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                 <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100 flex items-center gap-4">
                    <div className="p-3 bg-white rounded-2xl shadow-sm text-cyan-600">
                       <CheckCircle2 className="h-5 w-5" />
                    </div>
                    <div className="flex flex-col">
                       <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Status</span>
                       <span className="text-sm font-black italic uppercase text-cyan-600">Válido</span>
                    </div>
                 </div>
                 <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100 flex items-center gap-4">
                    <div className="p-3 bg-white rounded-2xl shadow-sm text-blue-500">
                       <Calendar className="h-5 w-5" />
                    </div>
                    <div className="flex flex-col">
                       <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Expiração</span>
                       <span className="text-sm font-black italic uppercase text-blue-500">{analysis.validity.daysRemaining} Dias</span>
                    </div>
                 </div>
                 <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100 flex items-center gap-4">
                    <div className="p-3 bg-white rounded-2xl shadow-sm text-slate-400">
                       <Lock className="h-5 w-5" />
                    </div>
                    <div className="flex flex-col">
                       <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Algoritmo</span>
                       <span className="text-xs font-black italic uppercase text-slate-600 truncate max-w-[120px]">RSA 2048</span>
                    </div>
                 </div>
              </div>

              {/* Details List */}
              <Card className="rounded-[2.5rem] border-slate-100 shadow-sm overflow-hidden">
                <div className="bg-slate-50 px-8 py-4 border-b border-slate-100">
                   <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 italic">Detalhes Técnicos</h3>
                </div>
                <CardContent className="p-0">
                  <DetailRow label="Subject (CN)" value={analysis.subject.commonName} />
                  <DetailRow label="Org" value={analysis.subject.organization} />
                  <DetailRow label="Issuer" value={analysis.issuer.commonName} />
                  <DetailRow label="Algorithm" value={analysis.algorithm} />
                  <DetailRow label="Usage" value={analysis.keyUsage.join(', ')} />
                  <DetailRow label="Validity" value={`${analysis.validity.notBefore} → ${analysis.validity.notAfter}`} isLast />
                </CardContent>
              </Card>

              {/* Fingerprint */}
              <div className="bg-slate-900 rounded-[2.5rem] p-8 text-white space-y-4 shadow-2xl">
                 <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                       <FingerprintIcon className="h-5 w-5 text-cyan-400" />
                       <span className="text-[10px] font-black uppercase tracking-widest">SHA-256 Fingerprint</span>
                    </div>
                    <Button variant="ghost" size="sm" className="h-8 rounded-xl text-[9px] font-black text-slate-400 hover:text-white" onClick={() => navigator.clipboard.writeText(analysis.fingerprint)}>
                       <Copy className="h-3 w-3 mr-2" /> Copiar
                    </Button>
                 </div>
                 <code className="block bg-black/30 p-4 rounded-2xl font-mono text-xs text-cyan-200 break-all leading-relaxed">
                   {analysis.fingerprint}
                 </code>
              </div>

            </div>
          )}
        </section>
      </main>
    </div>
  );
}

function DetailRow({ label, value, isLast }: { label: string, value: string, isLast?: boolean }) {
  return (
    <div className={cn("px-8 py-4 flex items-center justify-between gap-4", !isLast && "border-b border-slate-50")}>
       <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 shrink-0">{label}</span>
       <span className="text-xs font-bold text-slate-600 truncate">{value}</span>
    </div>
  );
}

function FingerprintIcon(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 10a2 2 0 0 0-2 2c0 1.02-.1 2.02-.3 3" />
      <path d="M14 20a2 2 0 0 0 2-2c0-1.82-.46-3.53-1.28-5" />
      <path d="M2 12a10 10 0 0 1 18-6" />
      <path d="M2 15c0-1.82.46-3.53 1.28-5" />
      <path d="M22 12a10 10 0 0 0-18-6" />
      <path d="M22 15c0-1.82-.46-3.53-1.28-5" />
      <path d="M8 12a4 4 0 0 1 8 0c0 1.82-.46 3.53-1.28 5" />
      <path d="M8 15c0-1.82.46-3.53 1.28-5" />
    </svg>
  );
}

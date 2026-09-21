'use client';

import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  ShieldCheck,
  Key,
  ArrowLeft,
  Copy,
  Lock,
  Calendar,
  FileCode,
  CheckCircle2,
  AlertCircle,
  ShieldAlert
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import forge from 'node-forge';

interface CertAnalysis {
  subject: { commonName: string; organization: string; country: string };
  issuer: { commonName: string; organization: string };
  validity: { notBefore: string; notAfter: string; daysRemaining: number; isExpired: boolean; isSelfSigned: boolean };
  algorithm: string;
  keySize: string;
  keyUsage: string[];
  fingerprint: string;
  serialNumber: string;
}

const KEY_USAGE_LABELS: Record<string, string> = {
  digitalSignature: 'Assinatura Digital',
  nonRepudiation: 'Não Repúdio',
  keyEncipherment: 'Cifragem de Chave',
  dataEncipherment: 'Cifragem de Dados',
  keyAgreement: 'Acordo de Chave',
  keyCertSign: 'Assinatura de Certificados (CA)',
  cRLSign: 'Assinatura de CRL',
};

function getField(attrs: forge.pki.CertificateField[], shortName: string): string {
  const field = attrs.find((a) => a.shortName === shortName);
  const value = field?.value;
  return typeof value === 'string' && value.length > 0 ? value : '—';
}

function parseCertificate(pem: string): CertAnalysis {
  const cert = forge.pki.certificateFromPem(pem);

  const now = new Date();
  const { notBefore, notAfter } = cert.validity;
  const daysRemaining = Math.ceil((notAfter.getTime() - now.getTime()) / 86400000);
  const isExpired = now > notAfter || now < notBefore;

  const algorithmOid = (cert as any).siginfo?.algorithmOid;
  const algorithm = (algorithmOid && (forge.pki.oids as Record<string, string>)[algorithmOid]) || algorithmOid || 'Desconhecido';

  let keySize = 'Não determinado (tipo de chave não suportado por node-forge)';
  const publicKey = cert.publicKey as any;
  if (typeof publicKey?.n?.bitLength === 'function') {
    keySize = `RSA ${publicKey.n.bitLength()} bits`;
  }

  const keyUsageExt = cert.getExtension('keyUsage') as any;
  const keyUsage = keyUsageExt
    ? Object.entries(KEY_USAGE_LABELS).filter(([key]) => keyUsageExt[key]).map(([, label]) => label)
    : [];

  const der = forge.asn1.toDer(forge.pki.certificateToAsn1(cert)).getBytes();
  const fingerprint = forge.md.sha256.create().update(der).digest().toHex().toUpperCase().match(/.{1,2}/g)!.join(':');

  const subjectCN = getField(cert.subject.attributes, 'CN');
  const issuerCN = getField(cert.issuer.attributes, 'CN');

  return {
    subject: {
      commonName: subjectCN,
      organization: getField(cert.subject.attributes, 'O'),
      country: getField(cert.subject.attributes, 'C'),
    },
    issuer: {
      commonName: issuerCN,
      organization: getField(cert.issuer.attributes, 'O'),
    },
    validity: {
      notBefore: notBefore.toISOString().split('T')[0],
      notAfter: notAfter.toISOString().split('T')[0],
      daysRemaining,
      isExpired,
      isSelfSigned: subjectCN !== '—' && subjectCN === issuerCN,
    },
    algorithm,
    keySize,
    keyUsage,
    fingerprint,
    serialNumber: cert.serialNumber,
  };
}

export default function CertInspectorPage() {
  const { toast } = useToast();
  const [certText, setCertText] = useState('');
  const [analysis, setAnalysis] = useState<CertAnalysis | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleInspect = () => {
    if (!certText) return;

    try {
      const result = parseCertificate(certText);
      setAnalysis(result);
      setError(null);
      toast({ title: "Certificado analisado com sucesso!" });
    } catch (e: any) {
      setAnalysis(null);
      const message = `Não foi possível interpretar o certificado. Confirme se é um bloco PEM válido (-----BEGIN CERTIFICATE----- ... -----END CERTIFICATE-----). Detalhe: ${e?.message || 'erro desconhecido'}`;
      setError(message);
      toast({
        title: "Erro na análise",
        description: message,
        variant: "destructive"
      });
    }
  };

  return (
    <div className="flex flex-col h-screen bg-background overflow-hidden">
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
            onClick={() => { setCertText(''); setAnalysis(null); setError(null); }}
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
              className="w-full h-full resize-none border-none font-code text-[11px] leading-relaxed focus-visible:ring-0 placeholder:italic"
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
          {error ? (
            <div className="h-full flex flex-col items-center justify-center gap-6 text-center px-12">
              <div className="w-32 h-32 rounded-[3.5rem] bg-red-50 flex items-center justify-center">
                <AlertCircle className="h-16 w-16 text-red-300" />
              </div>
              <div className="space-y-2 max-w-md">
                <h3 className="text-xl font-black uppercase tracking-tighter italic text-red-400">Erro na Análise</h3>
                <p className="text-xs font-bold text-slate-400 leading-relaxed">{error}</p>
              </div>
            </div>
          ) : !analysis ? (
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

              {analysis.validity.isSelfSigned && (
                <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-2xl px-5 py-3">
                  <ShieldAlert className="h-4 w-4 text-amber-600 shrink-0" />
                  <span className="text-[11px] font-bold text-amber-700">Certificado autoassinado (subject e issuer são o mesmo CN) — normal para CAs internas, inesperado para um servidor público.</span>
                </div>
              )}

              {/* Summary Widgets */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                 <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100 flex items-center gap-4">
                    <div className={cn("p-3 bg-white rounded-2xl shadow-sm", analysis.validity.isExpired ? "text-red-500" : "text-cyan-600")}>
                       <CheckCircle2 className="h-5 w-5" />
                    </div>
                    <div className="flex flex-col">
                       <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Status</span>
                       <span className={cn("text-sm font-black italic uppercase", analysis.validity.isExpired ? "text-red-500" : "text-cyan-600")}>
                         {analysis.validity.isExpired ? 'Expirado' : 'Válido'}
                       </span>
                    </div>
                 </div>
                 <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100 flex items-center gap-4">
                    <div className="p-3 bg-white rounded-2xl shadow-sm text-blue-500">
                       <Calendar className="h-5 w-5" />
                    </div>
                    <div className="flex flex-col">
                       <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                         {analysis.validity.isExpired ? 'Expirou há' : 'Expiração'}
                       </span>
                       <span className="text-sm font-black italic uppercase text-blue-500">{Math.abs(analysis.validity.daysRemaining)} Dias</span>
                    </div>
                 </div>
                 <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100 flex items-center gap-4">
                    <div className="p-3 bg-white rounded-2xl shadow-sm text-slate-400">
                       <Lock className="h-5 w-5" />
                    </div>
                    <div className="flex flex-col">
                       <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Chave</span>
                       <span className="text-xs font-black italic uppercase text-slate-600 truncate max-w-[160px]" title={analysis.keySize}>{analysis.keySize}</span>
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
                  <DetailRow label="Org (Subject)" value={analysis.subject.organization} />
                  <DetailRow label="País (Subject)" value={analysis.subject.country} />
                  <DetailRow label="Issuer (CN)" value={analysis.issuer.commonName} />
                  <DetailRow label="Org (Issuer)" value={analysis.issuer.organization} />
                  <DetailRow label="Algoritmo" value={analysis.algorithm} />
                  <DetailRow label="Serial" value={analysis.serialNumber} />
                  <DetailRow label="Key Usage" value={analysis.keyUsage.length ? analysis.keyUsage.join(', ') : 'Extensão ausente'} />
                  <DetailRow label="Validade" value={`${analysis.validity.notBefore} → ${analysis.validity.notAfter}`} isLast />
                </CardContent>
              </Card>

              {/* Fingerprint */}
              <div className="bg-slate-900 rounded-[2.5rem] p-8 text-white space-y-4 shadow-2xl">
                 <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                       <FileCode className="h-5 w-5 text-cyan-400" />
                       <span className="text-[10px] font-black uppercase tracking-widest">SHA-256 Fingerprint</span>
                    </div>
                    <Button variant="ghost" size="sm" className="h-8 rounded-xl text-[9px] font-black text-slate-400 hover:text-white" onClick={() => navigator.clipboard.writeText(analysis.fingerprint)}>
                       <Copy className="h-3 w-3 mr-2" /> Copiar
                    </Button>
                 </div>
                 <code className="block bg-black/30 p-4 rounded-2xl font-code text-xs text-cyan-200 break-all leading-relaxed">
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

'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  ShieldCheck, Trash2, Copy, Zap, Clock,
  CheckCircle2, AlertTriangle, Terminal, Lock
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { encryptSecret } from '@/lib/vault-crypto';
import { useUserContext } from '@/context/UserContext';
import { vaultApi } from '@/app/vault/api';
import { Footer } from '@/components/layout/Footer';

export default function SecretVaultPage() {
  const [secret, setSecret] = useState('');
  const [isEncrypting, setIsEncrypting] = useState(false);
  const [generatedLink, setGeneratedLink] = useState('');
  const [expiration, setExpiration] = useState<'once' | '1h' | '24h'>('once');
  const { toast } = useToast();
  const { userProfile, requestIdentity } = useUserContext();

  useEffect(() => { document.title = `Secret Vault | DevTools Hub`; }, []);

  const handleGenerate = async () => {
    if (!secret.trim()) {
      toast({ title: "Conteúdo Vazio", description: "Insira o dado que deseja proteger.", variant: "destructive" });
      return;
    }
    if (!userProfile) {
      toast({ title: "Autenticação Necessária", description: "Você precisa estar logado para gerar um cofre." });
      requestIdentity();
      return;
    }
    setIsEncrypting(true);
    try {
      const { ciphertext, key, iv } = await encryptSecret(secret);
      const savedSecret = await vaultApi.createSecret({
        payload: ciphertext,
        iv,
        expirationType: expiration,
      });
      setGeneratedLink(`${window.location.origin}/vault/${savedSecret.id}#${key}`);
      toast({ title: "Cofre Criado!", description: "Segredo criptografado e pronto para envio." });
    } catch (err) {
      console.error(err);
      toast({ title: "Erro", description: "Não foi possível gerar o cofre.", variant: "destructive" });
    } finally {
      setIsEncrypting(false);
    }
  };

  const copyLink = () => {
    navigator.clipboard.writeText(generatedLink);
    toast({ title: "Copiado!", description: "Link copiado para a área de transferência." });
  };

  return (
    <div className="h-screen flex flex-col bg-slate-50 font-sans overflow-hidden selection:bg-emerald-500/30">
      {/* Background glows */}
      <div className="absolute inset-0 pointer-events-none -z-10 overflow-hidden">
        <div className="absolute -top-32 -right-32 w-[600px] h-[600px] bg-emerald-100/30 blur-[120px] rounded-full" />
        <div className="absolute -bottom-32 -left-32 w-[400px] h-[400px] bg-blue-100/20 blur-[100px] rounded-full" />
      </div>

      {/* Header */}
      <header className="shrink-0 px-8 py-4 border-b border-slate-200 bg-white/80 backdrop-blur-sm flex items-center justify-between z-30 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-emerald-50 rounded-xl border border-emerald-100 shadow-sm">
            <ShieldCheck className="h-6 w-6 text-emerald-600" />
          </div>
          <div>
            <h1 className="text-base font-black italic tracking-tighter text-slate-800 uppercase leading-none">
              Secret <span className="text-emerald-600">Vault</span>
            </h1>
            <p className="text-[8px] font-bold text-slate-500 uppercase tracking-[0.2em] mt-1">Protocolo de Segurança Corporativa E2EE</p>
          </div>
        </div>
        <Link href="/" className="text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-slate-900 transition-colors">
          Espaço Ágil
        </Link>
      </header>

      {/* Main — Optimized centered column */}
      <main className="flex-1 min-h-0 flex flex-col items-center justify-start px-8 pt-10 pb-10">
        <div className="w-full max-w-4xl">
          <AnimatePresence mode="wait">

            {/* ── CREATOR ── */}
            {!generatedLink ? (
              <motion.div key="form"
                initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.3, ease: "easeOut" }}
                className="space-y-10"
              >
                {/* Título + "Como usar" inline */}
                <div className="space-y-4 text-center">
                  <h2 className="text-5xl md:text-6xl font-black italic tracking-tighter text-slate-800 uppercase leading-none">
                    Cofre de <span className="text-emerald-600">Segredos</span>
                  </h2>
                  <p className="text-[12px] font-semibold text-slate-600 leading-relaxed max-w-2xl mx-auto uppercase tracking-wide">
                    Precisa compartilhar uma senha, token ou dado sensível com um colega?
                    Cole abaixo e gere o link. O conteúdo é criptografado localmente
                    e <span className="text-rose-600 font-black">apagado permanentemente</span> assim que for lido.
                  </p>
                </div>

                {/* Card do Formulário */}
                <Card className="bg-white/70 backdrop-blur-md border-slate-200 p-10 rounded-[3rem] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.08)] relative overflow-hidden group">
                  <div className="space-y-8">
                    {/* Campo */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between px-2">
                        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-600 italic flex items-center gap-2">
                          <Terminal className="h-4 w-4" /> Conteúdo Confidencial
                        </label>
                        <Badge variant="outline" className="bg-emerald-50/50 border-emerald-100 text-emerald-600 text-[8px] font-black tracking-widest uppercase">
                          AES-256-GCM Ativo
                        </Badge>
                      </div>
                      <Textarea
                        value={secret}
                        onChange={(e) => setSecret(e.target.value)}
                        placeholder="Insira aqui senhas, chaves de API ou qualquer dado sensível que precise de proteção total..."
                        className="bg-white border-slate-200 rounded-[2rem] min-h-[180px] text-base font-mono text-slate-800 p-8 resize-none focus:border-emerald-300 focus:ring-4 focus:ring-emerald-500/5 shadow-inner transition-all leading-relaxed"
                      />
                    </div>

                    {/* Controles */}
                    <div className="flex flex-col md:flex-row gap-8 items-stretch">
                      <div className="flex-1 space-y-3">
                        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 ml-2">Validade do Link</label>
                        <div className="grid grid-cols-3 gap-3">
                          {[
                            { id: 'once', label: 'Uso Único', icon: Trash2 },
                            { id: '1h',   label: '1 Hora',    icon: Clock  },
                            { id: '24h',  label: '24 Horas',  icon: Zap    },
                          ].map(opt => (
                            <button key={opt.id} onClick={() => setExpiration(opt.id as any)}
                              className={cn(
                                "flex flex-col items-center justify-center gap-2 py-4 rounded-2xl border text-[10px] font-black uppercase tracking-widest transition-all duration-300",
                                expiration === opt.id
                                  ? "bg-emerald-600 border-emerald-600 text-white shadow-xl shadow-emerald-600/20 scale-105"
                                  : "bg-slate-50 border-transparent text-slate-400 hover:bg-slate-100"
                              )}>
                              <opt.icon className="h-5 w-5" />
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="flex-1 flex flex-col justify-end">
                        <Button onClick={handleGenerate} disabled={isEncrypting || !secret}
                          className="h-full min-h-[80px] bg-slate-900 hover:bg-emerald-600 text-white rounded-[2rem] font-black uppercase tracking-[0.3em] text-xs gap-4 transition-all duration-500 shadow-2xl active:scale-95">
                          {isEncrypting
                            ? <><Zap className="h-6 w-6 animate-spin" /><span>Criptografando...</span></>
                            : <><ShieldCheck className="h-6 w-6" /><span>Gerar Link Seguro</span></>}
                        </Button>
                      </div>
                    </div>
                  </div>
                </Card>

                {/* Indicadores de Segurança */}
                <div className="flex items-center justify-center gap-12 pt-4">
                  {[
                    { label: "Criptografia Local", icon: ShieldCheck },
                    { label: "Zero-Knowledge", icon: Lock },
                    { label: "Autodestruição", icon: Trash2 }
                  ].map(item => (
                    <div key={item.label} className="flex items-center gap-3 group opacity-60 hover:opacity-100 transition-opacity">
                      <item.icon className="h-4 w-4 text-emerald-500" />
                      <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">{item.label}</span>
                    </div>
                  ))}
                </div>
              </motion.div>
            ) : (

              /* ── RESULTADO ── */
              <motion.div key="result"
                initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
                className="space-y-10 max-w-3xl mx-auto"
              >
                <div className="text-center space-y-4">
                  <div className="mx-auto w-20 h-20 rounded-[2.5rem] bg-emerald-600 text-white flex items-center justify-center mb-6 shadow-2xl shadow-emerald-600/30">
                    <CheckCircle2 className="h-10 w-10 animate-pulse" />
                  </div>
                  <h2 className="text-5xl font-black italic tracking-tighter text-slate-800 uppercase leading-none">
                    Link <span className="text-emerald-600">Gerado</span>
                  </h2>
                  <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">
                    Segredo protegido com sucesso. Envie o link abaixo para o destinatário.
                  </p>
                </div>

                <Card className="bg-slate-900 border-slate-800 p-10 rounded-[3.5rem] shadow-2xl relative overflow-hidden">
                  <div className="absolute top-6 right-8">
                    <Badge variant="outline" className="border-emerald-500/30 text-emerald-400 text-[8px] font-black uppercase tracking-widest bg-emerald-500/5">
                      Segurança E2EE Ativa
                    </Badge>
                  </div>
                  <div className="bg-black/30 p-8 rounded-3xl border border-white/5 break-all font-mono text-sm text-emerald-400 leading-relaxed text-left mb-10 shadow-inner">
                    {generatedLink}
                  </div>
                  <div className="flex flex-col md:flex-row gap-4">
                    <Button onClick={copyLink}
                      className="flex-[2] h-16 bg-white text-slate-900 hover:bg-emerald-500 hover:text-white rounded-2xl font-black uppercase text-[11px] tracking-[0.2em] gap-3 transition-all duration-300 shadow-xl">
                      <Copy className="h-5 w-5" /> Copiar Link Seguro
                    </Button>
                    <Button variant="outline" onClick={() => { setGeneratedLink(''); setSecret(''); }}
                      className="flex-1 h-16 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10 rounded-2xl font-black uppercase text-[11px] tracking-widest transition-all">
                      Novo Segredo
                    </Button>
                  </div>
                </Card>

                <div className="flex flex-col items-center gap-4">
                  <div className="px-6 py-3 bg-rose-50 rounded-full border border-rose-100">
                    <p className="text-[10px] font-black uppercase tracking-widest text-rose-600 flex items-center gap-3">
                      <AlertTriangle className="h-4 w-4 shrink-0" />
                      Aviso: O conteúdo será destruído permanentemente após o acesso.
                    </p>
                  </div>
                </div>
              </motion.div>
            )}

          </AnimatePresence>
        </div>
      </main>

      {/* Footer */}
      <Footer 
        className="mt-8 shrink-0" 
        subtitle="Vault Protocol v1.0 • Espaço Ágil Compliance" 
        badge={
          <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-3 py-1 rounded-xl border border-emerald-200/60 dark:border-emerald-800/60">
            <ShieldCheck className="h-3.5 w-3.5" />
            <span className="text-[9px] font-black uppercase tracking-widest">Proteção Ativa</span>
          </div>
        }
      />
    </div>
  );
}

'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ShieldCheck, 
  ShieldAlert, 
  Lock, 
  Unlock, 
  Trash2, 
  Copy, 
  XCircle, 
  Zap,
  AlertTriangle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { decryptSecret } from '@/lib/vault-crypto';
import Link from 'next/link';
import { vaultApi } from '@/app/vault/api';
import { Footer } from '@/components/layout/Footer';

export default function VaultReaderPage() {
  const { id } = useParams();
  const router = useRouter();
  const [status, setStatus] = useState<'loading' | 'ready' | 'revealing' | 'revealed' | 'destroyed' | 'error'>('loading');
  const [secret, setSecret] = useState('');
  const [isRevealing, setIsRevealing] = useState(false);

  const isExpired = (data: any) => {
    const expiresAt = data?.expiresAt;
    if (!expiresAt) return false;
    const expiryMs = new Date(expiresAt).getTime();
    return Number.isFinite(expiryMs) && expiryMs < Date.now();
  };

  const fetchSecret = async () => {
    try {
      const data = await vaultApi.getSecret(id as string);

      if (!data || isExpired(data)) {
        setStatus('destroyed');
        return;
      }

      setStatus('ready');
    } catch (error) {
      console.error('Error fetching secret:', error);
      setStatus('error');
    }
  };

  useEffect(() => {
    if (id) {
      fetchSecret();
    }
  }, [id]);

  const handleReveal = async () => {
    setIsRevealing(true);
    setStatus('revealing');

    try {
      // 1. Pegar a chave do hash da URL
      const hash = window.location.hash;
      if (!hash || hash.length < 10) {
        setStatus('error');
        return;
      }
      const encryptionKey = hash.substring(1);

      // 2. Buscar e processar o segredo
      const data = await vaultApi.getSecret(id as string);

      if (!data || isExpired(data)) {
        setStatus('destroyed');
        return;
      }

      // 3. Descriptografar
      try {
        const decrypted = await decryptSecret(data.payload, encryptionKey, data.iv);
        setSecret(decrypted);
        setStatus('revealed');
        toast.success('Segredo revelado com sucesso!');
      } catch (e) {
        console.error('Decryption failed:', e);
        setStatus('error');
        toast.error('Falha ao descriptografar. A chave pode estar incorreta.');
      }
    } catch (error) {
      console.error('Reveal error:', error);
      setStatus('error');
    } finally {
      setIsRevealing(false);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(secret);
    toast.success('Copiado para a área de transferência!');
  };

  return (
    <div className="flex-1 flex flex-col bg-slate-50 relative overflow-hidden font-sans min-h-screen selection:bg-emerald-500/30">
      {/* Mesh Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none -z-10">
        <div className="absolute top-[-10%] right-[-10%] w-[600px] h-[600px] bg-emerald-100/20 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-5%] left-[-5%] w-[500px] h-[500px] bg-rose-100/10 blur-[100px] rounded-full" />
      </div>

      <header className="px-6 py-4 border-b border-slate-200 bg-white flex items-center justify-between sticky top-0 z-30 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-emerald-50 rounded-xl border border-emerald-100">
            <ShieldCheck className="h-5 w-5 text-emerald-600" />
          </div>
          <div className="flex flex-col">
            <h1 className="text-sm font-black italic tracking-tighter text-slate-800 uppercase leading-none">
              Secret <span className="text-emerald-600">Vault</span>
            </h1>
            <p className="text-[7px] font-bold text-slate-500 uppercase tracking-[0.2em] mt-1">Protocolo de Segurança E2EE</p>
          </div>
        </div>
        <Link href="/" className="text-[9px] font-black uppercase tracking-widest text-slate-600 hover:text-slate-900 transition-colors">Espaço Ágil</Link>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center p-4 text-center overflow-hidden">
        <div className="w-full max-w-xl space-y-8">
          <AnimatePresence mode="wait">
            {status === 'loading' && (
              <motion.div 
                key="loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center gap-6"
              >
                <div className="w-16 h-16 border-4 border-slate-200 border-t-emerald-600 rounded-full animate-spin" />
                <p className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-500">Validando Acesso...</p>
              </motion.div>
            )}

            {status === 'ready' && (
              <motion.div 
                key="ready"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="space-y-10"
              >
                <div className="space-y-4">
                  <div className="mx-auto w-20 h-20 rounded-[2rem] bg-white border border-slate-200 shadow-xl shadow-slate-200/50 flex items-center justify-center mb-6 rotate-3 hover:rotate-0 transition-transform duration-500">
                    <ShieldAlert className="h-10 w-10 text-amber-600" />
                  </div>
                  <h2 className="text-4xl md:text-5xl font-black text-slate-800 italic tracking-tighter uppercase leading-none">
                    Cofre <span className="text-amber-600">Localizado</span>
                  </h2>
                  <p className="text-[10px] font-bold text-slate-600 uppercase tracking-[0.2em] max-w-md mx-auto leading-relaxed">
                    Este conteúdo será revelado e <span className="text-rose-600 underline decoration-2 underline-offset-4 font-black">destruído permanentemente</span> após a leitura.
                  </p>
                </div>

                <Card className="bg-white border-slate-200 p-8 rounded-[2.5rem] shadow-[0_20px_40px_-12px_rgba(0,0,0,0.06)] overflow-hidden relative group">
                  <div className="absolute inset-0 bg-gradient-to-b from-amber-50/20 to-transparent pointer-events-none" />
                  
                  <div className="relative z-10 space-y-8">
                    <div className="flex items-center justify-center gap-12">
                      <div className="text-center">
                        <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center mx-auto mb-2 border border-emerald-100">
                          <ShieldCheck className="h-4 w-4 text-emerald-600" />
                        </div>
                        <span className="text-[8px] font-black uppercase tracking-widest text-slate-500">Protocolo E2EE</span>
                      </div>
                      <div className="text-center">
                        <div className="w-10 h-10 rounded-xl bg-rose-50 flex items-center justify-center mx-auto mb-2 border border-rose-100">
                          <Trash2 className="h-4 w-4 text-rose-600" />
                        </div>
                        <span className="text-[8px] font-black uppercase tracking-widest text-slate-500">Autodestruição</span>
                      </div>
                    </div>

                    <Button 
                      onClick={handleReveal}
                      disabled={isRevealing}
                      className="w-full h-16 bg-slate-900 hover:bg-emerald-600 text-white rounded-[1.5rem] font-black uppercase text-[12px] tracking-[0.2em] shadow-xl transition-all gap-3 active:scale-95 group"
                    >
                      {isRevealing ? (
                        <Zap className="h-8 w-8 animate-spin" />
                      ) : (
                        <>
                          <Lock className="h-8 w-8 group-hover:hidden" />
                          <Unlock className="h-8 w-8 hidden group-hover:block" />
                          Revelar e Destruir
                        </>
                      )}
                    </Button>
                  </div>
                </Card>
              </motion.div>
            )}

            {status === 'revealed' && (
              <motion.div 
                key="revealed"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full space-y-8"
              >
                <div className="space-y-4">
                  <h2 className="text-3xl font-black text-slate-800 italic tracking-tighter uppercase leading-none">
                    Conteúdo <span className="text-emerald-600">Revelado</span>
                  </h2>
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-rose-600 animate-pulse">
                    ⚠️ Atenção: Esta informação acaba de ser deletada do servidor
                  </p>
                </div>

                <Card className="bg-slate-900 border-slate-800 p-10 rounded-[2.5rem] shadow-2xl shadow-slate-900/40 relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-4">
                    <Badge variant="outline" className="border-emerald-500/30 text-emerald-500 text-[8px] font-black uppercase tracking-widest bg-emerald-500/5">
                      Seguro
                    </Badge>
                  </div>
                  <pre className="text-left whitespace-pre-wrap break-all font-mono text-sm md:text-base text-emerald-400/90 leading-relaxed bg-black/20 p-6 rounded-2xl border border-white/5">
                    {secret}
                  </pre>
                  
                  <div className="mt-8 flex justify-end">
                    <Button 
                      onClick={copyToClipboard}
                      className="bg-white/10 hover:bg-white text-white hover:text-slate-900 rounded-xl font-black uppercase text-[10px] tracking-widest gap-2"
                    >
                      <Copy className="h-4 w-4" /> Copiar Tudo
                    </Button>
                  </div>
                </Card>

                <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">
                  O acesso a este link foi invalidado permanentemente.
                </p>
              </motion.div>
            )}

            {status === 'destroyed' && (
              <motion.div 
                key="destroyed"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                className="space-y-10"
              >
                <div className="mx-auto w-24 h-24 rounded-[2.5rem] bg-slate-100 border border-slate-200 flex items-center justify-center mb-8">
                  <XCircle className="h-12 w-12 text-slate-400" />
                </div>
                <div className="space-y-4">
                  <h2 className="text-4xl font-black text-slate-800 italic tracking-tighter uppercase leading-none">
                    Link <span className="text-rose-600">Inexistente</span>
                  </h2>
                  <p className="text-[12px] font-bold text-slate-600 uppercase tracking-[0.2em] max-w-sm mx-auto leading-relaxed">
                    Este link expirou, já foi acessado ou nunca existiu. O segredo não pode ser recuperado.
                  </p>
                </div>
                <Button 
                  onClick={() => router.push('/devtools/secret-vault')}
                  className="h-20 px-12 bg-slate-900 text-white rounded-[1.5rem] font-black uppercase text-[12px] tracking-[0.3em]"
                >
                  Voltar ao Cofre
                </Button>
              </motion.div>
            )}

            {status === 'error' && (
              <motion.div 
                key="error"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="space-y-8"
              >
                <div className="mx-auto w-20 h-20 rounded-full bg-rose-50 border border-rose-200 flex items-center justify-center mb-4">
                  <AlertTriangle className="h-10 w-10 text-rose-600" />
                </div>
                <h2 className="text-3xl font-black text-slate-800 italic tracking-tighter uppercase leading-none">Erro de <span className="text-rose-600">Decodificação</span></h2>
                <p className="text-[11px] font-bold text-slate-600 uppercase tracking-[0.2em]">A URL pode estar incompleta ou a chave é inválida.</p>
                <Button onClick={fetchSecret} variant="outline" className="h-16 border-slate-200 text-slate-700 hover:bg-slate-50 rounded-2xl px-8 font-black uppercase text-[10px] tracking-widest">Tentar Novamente</Button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>

      <Footer 
        className="mt-8 shrink-0" 
        subtitle="Protocolo Queimar-Após-Leitura • Segurança Espaço Ágil" 
      />
    </div>
  );
}

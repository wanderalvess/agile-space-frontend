'use client';

import React, { useState, useEffect } from 'react';
import { 
  doc, 
  getDoc, 
  setDoc,
  serverTimestamp
} from 'firebase/firestore';
import { useFirebase } from '@/firebase';
import { 
  Palette, 
  Building2, 
  Image as ImageIcon, 
  Save,
  RotateCcw,
  Globe,
  Settings2,
  ShieldCheck,
  Zap,
  Music
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';
import { logSystemEvent } from '@/lib/audit';
import { AgileSpinner } from '../ui/AgileSpinner';
import { cn } from '@/lib/utils';

interface SystemConfig {
  companyName: string;
  primaryColor: string;
  logoUrl: string;
  allowAnonymous: boolean;
  maintenanceMode: boolean;
  spotifyClientId?: string;
  spotifyClientSecret?: string;
  updatedAt?: any;
}

const DEFAULT_CONFIG: SystemConfig = {
  companyName: 'Espaço Ágil',
  primaryColor: '24 93% 53%', // Cor primária padrão (Orange) em HSL
  logoUrl: '',
  allowAnonymous: true,
  maintenanceMode: false,
  spotifyClientId: 'a2693d23e9cb4c42b971c458f5ad20b8',
  spotifyClientSecret: 'f9652681c0cb41dba4375c4d733bf224'
};

export function SystemConfigManager() {
  const { firestore, user } = useFirebase();
  const [config, setConfig] = useState<SystemConfig>(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!firestore) return;
    loadConfig();
  }, [firestore]);

  const loadConfig = async () => {
    try {
      const docRef = doc(firestore!, 'system_configs', 'global');
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        setConfig(snap.data() as SystemConfig);
      }
    } catch (e) {
      console.error("Error loading config:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!firestore) return;
    setSaving(true);
    try {
      await setDoc(doc(firestore, 'system_configs', 'global'), {
        ...config,
        updatedAt: serverTimestamp()
      });
      
      await logSystemEvent(firestore, {
        content: `CONFIGURAÇÃO DE SISTEMA ALTERADA: Cores, Nome ou Permissões atualizadas.`,
        type: 'admin',
        severity: 'warning',
        userEmail: user?.email,
        module: 'SystemConfig'
      });

      toast({ title: "Configurações Salvas", description: "O sistema será atualizado globalmente." });
    } catch (e) {
      toast({ variant: "destructive", title: "Erro ao salvar" });
    } finally {
      setSaving(false);
    }
  };

  const resetToDefault = () => {
    if (confirm("Deseja resetar para o padrão de fábrica?")) {
      setConfig(DEFAULT_CONFIG);
    }
  };

  if (loading) {
    return (
      <div className="h-64 flex flex-col items-center justify-center gap-4">
        <AgileSpinner size="lg" />
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Carregando Preferências do Sistema...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Identidade Visual (Branding) */}
        <Card className="border-slate-200/60 rounded-[2rem] bg-white shadow-xl shadow-slate-200/50 overflow-hidden">
          <CardHeader className="p-5 border-b border-slate-50 flex items-center gap-4">
            <div className="p-2.5 bg-primary/10 rounded-xl text-primary"><Building2 className="h-5 w-5" /></div>
            <div>
              <CardTitle className="text-xl font-black uppercase tracking-tighter italic font-headline text-slate-900">Personalização</CardTitle>
              <CardDescription className="text-[9px] font-black italic text-slate-400 uppercase tracking-widest mt-0.5">Identidade Corporativa Unificada</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="p-5 space-y-5">
            <div className="space-y-3">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 pl-2">Nome da Empresa / Instância</label>
              <Input 
                value={config.companyName}
                onChange={(e) => setConfig({ ...config, companyName: e.target.value })}
                placeholder="Ex: Agile Squad Solutions"
                className="h-11 bg-slate-50 border-slate-200 rounded-xl font-bold"
              />
            </div>

            <div className="space-y-3">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 pl-2">Cor Primária (Formato HSL)</label>
              <div className="flex gap-4">
                <Input 
                  value={config.primaryColor}
                  onChange={(e) => setConfig({ ...config, primaryColor: e.target.value })}
                  placeholder="Ex: 24 93% 53%"
                  className="h-11 bg-slate-50 border-slate-200 rounded-xl font-mono text-xs"
                />
                <div 
                  className="w-11 h-11 rounded-xl shadow-xl border-4 border-white shrink-0" 
                  style={{ backgroundColor: `hsl(${config.primaryColor})` }}
                />
              </div>
              <p className="text-[9px] text-slate-400 font-medium px-2 italic">Dica: Use o formato "Hue Saturation Lightness" (Ex: 220 70% 50% para azul).</p>
            </div>

            <div className="space-y-3">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 pl-2">URL do Logo (SVG ou PNG Transparente)</label>
              <div className="relative group">
                <ImageIcon className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input 
                  value={config.logoUrl}
                  onChange={(e) => setConfig({ ...config, logoUrl: e.target.value })}
                  placeholder="https://suaempresa.com/logo.svg"
                  className="pl-12 h-11 bg-slate-50 border-slate-200 rounded-xl font-medium"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Políticas de Acesso & Segurança */}
        <div className="space-y-6">
          <Card className="border-slate-200/60 rounded-[2rem] bg-white shadow-xl shadow-slate-200/50 overflow-hidden">
            <CardHeader className="p-5 border-b border-slate-50 flex items-center gap-4">
              <div className="p-2.5 bg-slate-900 rounded-xl text-white shadow-lg"><Settings2 className="h-5 w-5" /></div>
              <div>
                <CardTitle className="text-xl font-black uppercase tracking-tighter italic font-headline text-slate-900">Políticas Globais</CardTitle>
                <CardDescription className="text-[9px] font-black italic text-slate-400 uppercase tracking-widest mt-0.5">Comportamento do Ecossistema</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="p-5 space-y-3">
              <div className="flex items-center justify-between p-5 bg-slate-50 rounded-3xl border border-slate-100 hover:border-primary/20 transition-all cursor-pointer group" onClick={() => setConfig({ ...config, allowAnonymous: !config.allowAnonymous })}>
                <div className="flex items-center gap-4">
                  <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center transition-all", config.allowAnonymous ? "bg-emerald-100 text-emerald-600" : "bg-slate-200 text-slate-500")}>
                    <Globe className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-[11px] font-black uppercase text-slate-900">Acesso Anônimo</p>
                    <p className="text-[9px] font-medium text-slate-400 uppercase tracking-widest">Permitir entrada via link de convidado</p>
                  </div>
                </div>
                <div className={cn("w-10 h-5 rounded-full relative transition-all", config.allowAnonymous ? "bg-emerald-500" : "bg-slate-300")}>
                  <div className={cn("absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all shadow-sm", config.allowAnonymous ? "right-0.5" : "left-0.5")} />
                </div>
              </div>

              <div className="flex items-center justify-between p-5 bg-rose-50/30 rounded-3xl border border-rose-100 hover:border-rose-300 transition-all cursor-pointer" onClick={() => setConfig({ ...config, maintenanceMode: !config.maintenanceMode })}>
                <div className="flex items-center gap-4">
                  <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center transition-all shadow-sm", config.maintenanceMode ? "bg-rose-600 text-white animate-pulse" : "bg-rose-100 text-rose-600")}>
                    <Zap className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-[11px] font-black uppercase text-rose-900">Modo Manutenção</p>
                    <p className="text-[9px] font-medium text-rose-400 uppercase tracking-widest">Bloquear acesso geral para reparos</p>
                  </div>
                </div>
                <div className={cn("w-10 h-5 rounded-full relative transition-all", config.maintenanceMode ? "bg-rose-600" : "bg-slate-300")}>
                  <div className={cn("absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all shadow-sm", config.maintenanceMode ? "right-0.5" : "left-0.5")} />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Integração Spotify */}
          <Card className="border-slate-200/60 rounded-[2rem] bg-white shadow-xl shadow-slate-200/50 overflow-hidden">
            <CardHeader className="p-5 border-b border-slate-50 flex items-center gap-4">
              <div className="p-2.5 bg-emerald-500/10 rounded-xl text-emerald-600"><Music className="h-5 w-5" /></div>
              <div>
                <CardTitle className="text-xl font-black uppercase tracking-tighter italic font-headline text-slate-900">Integração Spotify</CardTitle>
                <CardDescription className="text-[9px] font-black italic text-slate-400 uppercase tracking-widest mt-0.5">Credenciais de API para Calmaria</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="p-5 space-y-5">
              <div className="space-y-3">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 pl-2">Spotify Client ID</label>
                <Input 
                  value={config.spotifyClientId || ''}
                  onChange={(e) => setConfig({ ...config, spotifyClientId: e.target.value })}
                  placeholder="Ex: a2693d23e9cb..."
                  className="h-11 bg-slate-50 border-slate-200 rounded-xl font-medium"
                />
              </div>

              <div className="space-y-3">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 pl-2">Spotify Client Secret</label>
                <Input 
                  type="password"
                  value={config.spotifyClientSecret || ''}
                  onChange={(e) => setConfig({ ...config, spotifyClientSecret: e.target.value })}
                  placeholder="Seu Client Secret"
                  className="h-11 bg-slate-50 border-slate-200 rounded-xl font-medium"
                />
              </div>
            </CardContent>
          </Card>

          {/* Action Bar */}
          <div className="flex gap-4">
            <Button 
              onClick={handleSave} 
              disabled={saving}
              className="flex-[2] h-12 rounded-xl bg-slate-900 hover:bg-primary text-white font-black uppercase text-[10px] tracking-[0.2em] shadow-2xl active:scale-95 transition-all gap-3"
            >
              {saving ? 'PROCESSANDO...' : 'ATUALIZAR SISTEMA'}
              <Save className="h-4 w-4" />
            </Button>
            <Button 
              variant="outline" 
              onClick={resetToDefault}
              className="flex-1 h-12 rounded-xl border-slate-200 text-slate-400 font-black uppercase text-[9px] tracking-widest hover:bg-slate-50 transition-all gap-2"
            >
              <RotateCcw className="h-4 w-4" /> Reset
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

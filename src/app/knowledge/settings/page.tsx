"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Key,
  ShieldCheck,
  Eye,
  EyeOff,
  Save,
  ExternalLink,
  ChevronRight,
  Sparkles,
  Info,
  Lock,
  RotateCcw,
  Zap,
  Cpu,
  Brain,
  Activity,
  Coins,
  History
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/AuthContext';
import { knowledgeChatApi, KnowledgeTokenUsageDTO } from '../chat/api';
import { AgileSpinner } from '@/components/ui/AgileSpinner';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function KnowledgeSettingsPage() {
  const { session } = useAuth();
  const [model, setModel] = useState('');
  const [byokApiKey, setByokApiKey] = useState('');

  const [usage, setUsage] = useState<KnowledgeTokenUsageDTO | null>(null);
  const [showKey, setShowKey] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const { toast } = useToast();

  // Carregar configurações de IA (modelo + chave BYOK)
  useEffect(() => {
    async function loadConfig() {
      if (!session) return;
      setIsLoading(true);
      try {
        const settings = await knowledgeChatApi.getAiSettings();
        setModel(settings.model || '');
        setByokApiKey(settings.byokApiKey || '');
      } catch (e) {
        console.error("Erro ao carregar config:", e);
        toast({ title: "Não foi possível carregar suas configurações", description: "Recarregue a página antes de salvar, para não sobrescrever a chave atual.", variant: "destructive" });
        setLoadFailed(true);
      } finally {
        setTimeout(() => setIsLoading(false), 300);
      }
    }
    loadConfig();
  }, [session]);

  // Consumo de tokens: busca única no carregamento (sem realtime — decisão de produto).
  useEffect(() => {
    async function loadUsage() {
      if (!session) return;
      try {
        const data = await knowledgeChatApi.getTokenUsage();
        setUsage(data);
      } catch (e) {
        console.error("Erro ao carregar consumo de tokens:", e);
      }
    }
    loadUsage();
  }, [session]);

  const handleSave = async () => {
    if (!session || loadFailed) return;
    setIsSaving(true);
    try {
      await knowledgeChatApi.saveAiSettings({ model, byokApiKey });
      toast({ title: "Chave de API Atualizada!", description: "Sua chave de acesso foi sincronizada com segurança." });
    } catch (e) {
      toast({ title: "Erro ao salvar", description: e instanceof Error ? e.message : "Falha na sincronização. O que você digitou continua na tela.", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const providers = [
    { id: 'gemini', name: 'Google Gemini', modelValue: 'gemini', icon: Sparkles, color: 'cyan', link: 'https://aistudio.google.com/app/apikey', placeholder: 'AIzaSy...' },
    { id: 'openai', name: 'OpenAI GPT-4o', modelValue: 'openai', icon: Zap, color: 'emerald', link: 'https://platform.openai.com/api-keys', placeholder: 'sk-proj-...' },
    { id: 'anthropic', name: 'Anthropic Claude', modelValue: 'anthropic', icon: Brain, color: 'amber', link: 'https://console.anthropic.com/settings/keys', placeholder: 'sk-ant-...' }
  ];

  return (
    <div className="px-10 lg:px-16 py-4 lg:py-6 max-w-[1600px] mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700 h-full bg-white dark:bg-slate-950 pb-32">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-border pb-4">
         <div className="space-y-2">
            <h1 className="text-2xl font-black font-headline uppercase tracking-tighter italic text-foreground leading-none">
               Configurações da <span className="text-cyan-600 not-italic">Plataforma</span>
            </h1>
            <p className="text-xs text-muted-foreground font-medium max-w-lg leading-relaxed uppercase tracking-wide">
               Gerencie sua chave de API e monitore o consumo de tokens do motor.
            </p>
         </div>
         <div className="flex items-center gap-3">
            <Button onClick={handleSave} disabled={isSaving || loadFailed} className="h-10 px-6 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 rounded-xl font-black uppercase text-xs tracking-widest shadow-xl hover:bg-black dark:hover:bg-slate-200 gap-2 transition-all active:scale-95">
              {isSaving ? "Salvando..." : <><Save className="h-3.5 w-3.5 text-cyan-400" /> Salvar</>}
            </Button>
         </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        <div className="lg:col-span-8 space-y-8">
          {isLoading ? (
            <div className="py-40 flex flex-col items-center justify-center gap-6 bg-background rounded-[3rem] border border-dashed border-border">
              <AgileSpinner size="lg" variant="indigo" />
              <span className="text-xs font-black uppercase tracking-widest text-muted-foreground">Recuperando Chave Cifrada...</span>
            </div>
          ) : (
            <div className="p-6 bg-background border-2 border-border rounded-[2rem] space-y-6">
              <div className="space-y-3">
                <p className="text-xs font-black uppercase tracking-widest text-muted-foreground px-1">Motor Preferido</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {providers.map((provider) => (
                    <button
                      key={provider.id}
                      type="button"
                      disabled={provider.id !== 'gemini'}
                      title={provider.id !== 'gemini' ? 'Em breve: hoje o assistente funciona apenas com chave do Google Gemini' : undefined}
                      onClick={() => setModel(provider.modelValue)}
                      className={cn(
                        "p-5 rounded-2xl border-2 flex flex-col items-center gap-3 transition-all disabled:opacity-50 disabled:cursor-not-allowed",
                        model === provider.modelValue
                          ? "border-slate-900 dark:border-slate-100 bg-card shadow-lg"
                          : "border-border bg-card/50 hover:border-border"
                      )}
                    >
                      <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center shadow-lg", provider.id === 'gemini' ? "bg-slate-900 dark:bg-slate-950 text-cyan-400" : "bg-emerald-900 text-white")}>
                        <provider.icon className="h-6 w-6" />
                      </div>
                      <h3 className="text-xs font-black uppercase tracking-tight text-foreground text-center leading-tight">{provider.name}{provider.id !== 'gemini' && <span className="block text-xs tracking-widest text-muted-foreground">Em breve</span>}</h3>
                      <a href={provider.link} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="text-xs font-black uppercase tracking-widest text-cyan-600 flex items-center gap-1">Obter Chave <ExternalLink className="h-3 w-3" /></a>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-black uppercase tracking-widest text-muted-foreground px-1">Chave de API (BYOK)</p>
                <div className="relative">
                  <Input
                    type={showKey ? "text" : "password"}
                    value={byokApiKey}
                    onChange={(e) => setByokApiKey(e.target.value)}
                    placeholder="Cole sua chave de API do Google Gemini aqui..."
                    className="h-12 pl-4 pr-12 rounded-xl border border-border bg-card font-code text-sm text-foreground shadow-inner"
                  />
                  <button type="button" aria-label={showKey ? "Ocultar chave" : "Mostrar chave"} onClick={() => setShowKey(prev => !prev)} className="absolute right-4 top-1/2 -translate-y-1/2 p-1.5 text-muted-foreground hover:text-foreground">
                    {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="lg:col-span-4 space-y-6">
          {/* PAINEL DE CONSUMO DE TOKENS */}
          <Card className="border-2 border-slate-900 dark:border-slate-800 bg-slate-900 dark:bg-slate-950 rounded-[3rem] p-10 text-white shadow-3xl space-y-10 relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition-transform duration-1000">
              <Activity className="h-32 w-32 text-cyan-400" />
            </div>

            <div className="space-y-2 relative z-10">
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-cyan-500/20 text-cyan-400 rounded-full mb-4">
                 <Coins className="h-3.5 w-3.5" />
                 <span className="text-xs font-black uppercase tracking-[0.2em]">Monitor de Consumo do Motor</span>
              </div>
              <h3 className="text-3xl font-black uppercase tracking-tighter italic leading-none">Uso de Tokens</h3>
              <p className="text-xs font-black text-muted-foreground uppercase tracking-widest">{new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}</p>
            </div>

            <div className="space-y-8 relative z-10">
              <div className="space-y-4">
                <div className="flex items-center justify-between px-1">
                   <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Total Consumido</p>
                   <p className="text-sm font-black italic">{(usage?.totalTokens ?? 0).toLocaleString()} <span className="text-xs not-italic opacity-40 ml-1">TK</span></p>
                </div>
              </div>

              <div className="flex items-center gap-3 text-xs font-black uppercase text-muted-foreground italic mt-6">
                 <History className="h-4 w-4" /> Último pulso: {usage?.updatedAt ? formatDistanceToNow(new Date(usage.updatedAt), { locale: ptBR, addSuffix: true }) : '---'}
              </div>
            </div>
          </Card>

          <div className="p-8 border-2 border-border rounded-[2.5rem] bg-background space-y-6">
            <div className="flex items-center gap-3">
               <Info className="h-5 w-5 text-foreground" />
               <h4 className="text-xs font-black uppercase tracking-widest text-foreground">Sobre o Consumo</h4>
            </div>
            <p className="text-xs font-bold text-muted-foreground leading-relaxed uppercase">
              O monitoramento de tokens auxilia no controle de custos de sua chave BYOK. Os valores são atualizados a cada interação com o Assistente de Agilidade.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

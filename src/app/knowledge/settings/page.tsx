"use client";

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Eye,
  EyeOff,
  Save,
  ExternalLink,
  Sparkles,
  Info,
  Zap,
  Brain,
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

const FOCUS = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background';

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
    { id: 'gemini', name: 'Google Gemini', modelValue: 'gemini', icon: Sparkles, link: 'https://aistudio.google.com/app/apikey', placeholder: 'AIzaSy...' },
    { id: 'openai', name: 'OpenAI GPT-4o', modelValue: 'openai', icon: Zap, link: 'https://platform.openai.com/api-keys', placeholder: 'sk-proj-...' },
    { id: 'anthropic', name: 'Anthropic Claude', modelValue: 'anthropic', icon: Brain, link: 'https://console.anthropic.com/settings/keys', placeholder: 'sk-ant-...' }
  ];

  return (
    <div className="mx-auto w-full max-w-[1400px] space-y-6 px-4 pb-24 pt-6 md:px-8 lg:px-12 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300">
      <div className="flex flex-col justify-between gap-4 border-b border-border pb-5 md:flex-row md:items-end">
        <div className="space-y-1.5">
          <h1 className="text-3xl font-bold leading-tight tracking-tight text-foreground">Ajustes do assistente</h1>
          <p className="max-w-xl text-sm leading-relaxed text-muted-foreground">
            Gerencie sua chave de API e acompanhe o consumo de tokens do assistente.
          </p>
        </div>
        <Button onClick={handleSave} disabled={isSaving || loadFailed} className={cn('h-10 gap-2 rounded-[10px] px-6 text-sm font-semibold', FOCUS)}>
          {isSaving ? "Salvando..." : <><Save className="h-4 w-4" aria-hidden="true" /> Salvar</>}
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
        <div className="space-y-6 lg:col-span-8">
          {isLoading ? (
            <div role="status" className="flex flex-col items-center justify-center gap-5 rounded-2xl border border-dashed border-border bg-card py-32">
              <AgileSpinner size="lg" variant="indigo" />
              <span className="text-sm text-muted-foreground">Carregando suas configurações...</span>
            </div>
          ) : (
            <div className="space-y-6 rounded-2xl border border-border bg-card p-5 md:p-6">
              <div className="space-y-3">
                <h2 className="text-base font-semibold text-foreground">Provedor de IA</h2>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  {providers.map((provider) => {
                    const available = provider.id === 'gemini';
                    const selected = model === provider.modelValue;
                    return (
                      <div
                        key={provider.id}
                        className={cn(
                          "flex flex-col items-center gap-3 rounded-xl border p-4 motion-safe:transition-colors",
                          selected ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border bg-card",
                          !available && "opacity-70"
                        )}
                      >
                        <button
                          type="button"
                          disabled={!available}
                          aria-pressed={selected}
                          title={!available ? 'Em breve: hoje o assistente funciona apenas com chave do Google Gemini' : undefined}
                          onClick={() => setModel(provider.modelValue)}
                          className={cn("flex w-full flex-col items-center gap-3 rounded-lg disabled:cursor-not-allowed", FOCUS)}
                        >
                          <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                            <provider.icon className="h-6 w-6" aria-hidden="true" />
                          </span>
                          <span className="text-center text-sm font-semibold leading-tight text-foreground">
                            {provider.name}
                            {!available && <span className="mt-0.5 block text-[0.8125rem] font-normal text-muted-foreground">Em breve</span>}
                          </span>
                        </button>
                        <a
                          href={provider.link}
                          target="_blank"
                          rel="noreferrer"
                          className={cn("flex items-center gap-1 rounded-sm text-sm font-medium text-primary [.theme-totvs:not(.dark)_&]:text-foreground underline-offset-4 hover:underline", FOCUS)}
                        >
                          Obter chave <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                        </a>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-2">
                <label htmlFor="byok-api-key" className="block text-base font-semibold text-foreground">Chave de API (BYOK)</label>
                <div className="relative">
                  <Input
                    id="byok-api-key"
                    type={showKey ? "text" : "password"}
                    value={byokApiKey}
                    onChange={(e) => setByokApiKey(e.target.value)}
                    placeholder="Cole sua chave de API do Google Gemini aqui..."
                    autoComplete="off"
                    className="h-12 rounded-xl border border-border bg-background pl-4 pr-12 font-code text-sm text-foreground"
                  />
                  <button
                    type="button"
                    aria-label={showKey ? "Ocultar chave" : "Mostrar chave"}
                    onClick={() => setShowKey(prev => !prev)}
                    className={cn("absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-muted-foreground hover:text-foreground", FOCUS)}
                  >
                    {showKey ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="space-y-6 lg:col-span-4">
          {/* Consumo de tokens */}
          <section aria-labelledby="uso-tokens" className="space-y-5 rounded-2xl border border-border bg-card p-6">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 rounded-full bg-muted px-3 py-1 text-[0.8125rem] font-medium text-foreground">
                <Coins className="h-4 w-4" aria-hidden="true" />
                Consumo do assistente
              </div>
              <h2 id="uso-tokens" className="text-2xl font-bold leading-tight tracking-tight text-foreground">Uso de tokens</h2>
              <p className="text-sm capitalize text-muted-foreground">{new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}</p>
            </div>

            <div className="flex items-baseline justify-between gap-3 border-t border-border pt-4">
              <p className="text-sm text-muted-foreground">Total consumido</p>
              <p className="text-xl font-bold text-foreground">
                {(usage?.totalTokens ?? 0).toLocaleString('pt-BR')} <span className="text-sm font-normal text-muted-foreground">tokens</span>
              </p>
            </div>

            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <History className="h-4 w-4 shrink-0" aria-hidden="true" />
              Última atualização: {usage?.updatedAt ? formatDistanceToNow(new Date(usage.updatedAt), { locale: ptBR, addSuffix: true }) : '---'}
            </div>
          </section>

          <div className="space-y-3 rounded-2xl border border-border bg-card p-6">
            <div className="flex items-center gap-2.5">
              <Info className="h-5 w-5 text-foreground" aria-hidden="true" />
              <h2 className="text-base font-semibold text-foreground">Sobre o consumo</h2>
            </div>
            <p className="text-sm leading-relaxed text-muted-foreground">
              O monitoramento de tokens ajuda a controlar os custos da sua chave BYOK. Os valores são atualizados a cada interação com o Assistente de Agilidade.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

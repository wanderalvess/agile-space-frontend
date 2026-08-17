'use client';

import React, { useState, useEffect } from 'react';
import { 
  Link2, 
  Globe, 
  Save, 
  Loader2,
  Database,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  ShieldCheck,
  Zap
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useJiraSettings } from '@/hooks/useJiraSettings';
import { useTdnSettings } from '@/hooks/useTdnSettings';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

export function ConnectivitySettings() {
  const { toast } = useToast();
  
  // Jira Settings
  const { settings: jiraSettings, saveSettings: saveJira, loading: loadingJira } = useJiraSettings();
  const [jiraUrl, setJiraUrl] = useState('');
  const [jiraToken, setJiraToken] = useState('');

  // TDN Settings
  const { settings: tdnSettings, saveSettings: saveTdn, loading: loadingTdn } = useTdnSettings();
  const [tdnUrl, setTdnUrl] = useState('');
  const [tdnToken, setTdnToken] = useState('');
  const [tdnSpace, setTdnSpace] = useState('');
  const [tdnLabel, setTdnLabel] = useState('');

  const [isSaving, setIsSaving] = useState(false);

  // Sync state with loaded settings
  useEffect(() => {
    if (jiraSettings) {
      setJiraUrl(jiraSettings.domain || '');
      setJiraToken(jiraSettings.token || '');
    }
  }, [jiraSettings]);

  useEffect(() => {
    if (tdnSettings) {
      setTdnUrl(tdnSettings.baseUrl || '');
      setTdnToken(tdnSettings.token || '');
      setTdnSpace(tdnSettings.space || '');
      setTdnLabel(tdnSettings.label || '');
    }
  }, [tdnSettings]);

  const handleSaveAll = async () => {
    setIsSaving(true);
    try {
      await Promise.all([
        saveJira({ domain: jiraUrl, token: jiraToken }),
        saveTdn({ baseUrl: tdnUrl, token: tdnToken, space: tdnSpace, label: tdnLabel })
      ]);
      toast({
        title: "Conexões Atualizadas",
        description: "Suas credenciais de integração foram salvas com sucesso.",
      });
    } catch (error) {
      toast({
        title: "Erro ao Salvar",
        description: "Não foi possível salvar uma ou mais configurações.",
        variant: "destructive"
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      {/* Standard Header matching QuickLinks/DailyHelper */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="bg-cyan-50 text-cyan-600 border-cyan-100 font-black uppercase tracking-[0.2em] text-[7px] px-1.5 py-0 italic">Integrações</Badge>
          </div>
          <h1 className="text-2xl font-black italic tracking-tighter text-slate-900 uppercase flex items-center gap-3">
            Conexões e <span className="text-cyan-600 not-italic">Integrações</span>
          </h1>
          <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-slate-400">Sincronização de dados com ferramentas externas</p>
        </div>

        <Button 
          onClick={handleSaveAll} 
          disabled={isSaving || loadingJira || loadingTdn}
          className="h-10 px-8 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest gap-2 shadow-lg shadow-slate-900/10 active:scale-95 transition-all"
        >
          {isSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3.5 w-3.5 text-cyan-400" />}
          Salvar Configurações
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* JIRA SETTINGS */}
        <Card className="rounded-[2.5rem] border border-slate-100 bg-white shadow-xl shadow-slate-200/5 p-8 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 blur-3xl rounded-full translate-x-1/2 -translate-y-1/2" />
          
          <div className="space-y-6 relative z-10">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-blue-600 flex items-center justify-center text-white shadow-lg shadow-blue-600/20">
                  <Database className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-sm font-black uppercase tracking-widest text-slate-900">Jira Software</h3>
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tight">Atlassian Cloud Sync</p>
                </div>
              </div>
              <Badge className="bg-blue-50 text-blue-600 border-none font-black text-[8px] tracking-widest">v2.0 API</Badge>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Domínio da Instância</Label>
                <div className="relative">
                   <Globe className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300" />
                   <Input 
                    value={jiraUrl}
                    onChange={(e) => setJiraUrl(e.target.value)}
                    placeholder="exemplo.atlassian.net"
                    className="h-12 pl-11 rounded-xl border-slate-100 bg-slate-50/50 font-bold text-sm focus:bg-white focus:ring-blue-500/10"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Personal Access Token (PAT)</Label>
                <div className="relative">
                   <ShieldCheck className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300" />
                   <Input 
                    type="password"
                    value={jiraToken}
                    onChange={(e) => setJiraToken(e.target.value)}
                    placeholder="••••••••••••••••"
                    className="h-12 pl-11 rounded-xl border-slate-100 bg-slate-50/50 font-bold text-sm focus:bg-white focus:ring-blue-500/10"
                  />
                </div>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-blue-50/50 border border-blue-100/20">
              <p className="text-[10px] text-blue-700/70 leading-relaxed font-bold">
                Utilizado para importar Histórias de Usuário e Critérios de Aceite para as sessões de Poker.
              </p>
            </div>
          </div>
        </Card>

        {/* TDN SETTINGS */}
        <Card className="rounded-[2.5rem] border border-slate-100 bg-white shadow-xl shadow-slate-200/5 p-8 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/5 blur-3xl rounded-full translate-x-1/2 -translate-y-1/2" />
          
          <div className="space-y-6 relative z-10">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-cyan-500 flex items-center justify-center text-white shadow-lg shadow-cyan-500/20">
                  <Globe className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-sm font-black uppercase tracking-widest text-slate-900">TOTVS TDN</h3>
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tight">Technical Knowledge Hub</p>
                </div>
              </div>
              <Badge className="bg-cyan-50 text-cyan-600 border-none font-black text-[8px] tracking-widest">Confluence</Badge>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">URL Base do TDN</Label>
                <div className="relative">
                   <Zap className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300" />
                   <Input 
                    value={tdnUrl}
                    onChange={(e) => setTdnUrl(e.target.value)}
                    placeholder="tdn.totvs.com"
                    className="h-12 pl-11 rounded-xl border-slate-100 bg-slate-50/50 font-bold text-sm focus:bg-white focus:ring-cyan-500/10"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Personal Access Token (PAT)</Label>
                <div className="relative">
                   <ShieldCheck className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300" />
                   <Input 
                    type="password"
                    value={tdnToken}
                    onChange={(e) => setTdnToken(e.target.value)}
                    placeholder="••••••••••••••••"
                    className="h-12 pl-11 rounded-xl border-slate-100 bg-slate-50/50 font-bold text-sm focus:bg-white focus:ring-cyan-500/10"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Espaço (Space)</Label>
                  <Input 
                    value={tdnSpace}
                    onChange={(e) => setTdnSpace(e.target.value)}
                    placeholder="Ex: PRO"
                    className="h-10 rounded-xl border-slate-100 bg-slate-50/50 font-bold text-[11px] focus:bg-white focus:ring-cyan-500/10"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Rótulo (Label)</Label>
                  <Input 
                    value={tdnLabel}
                    onChange={(e) => setTdnLabel(e.target.value)}
                    placeholder="Ex: agile, space"
                    className="h-10 rounded-xl border-slate-100 bg-slate-50/50 font-bold text-[11px] focus:bg-white focus:ring-cyan-500/10"
                  />
                </div>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-cyan-50/50 border border-cyan-100/20">
              <p className="text-[10px] text-cyan-700/70 leading-relaxed font-bold">
                Permite buscar documentações técnicas da TOTVS e importá-las para sua Wiki local com um clique.
              </p>
            </div>
          </div>
        </Card>

      </div>
    </div>
  );
}

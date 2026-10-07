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
import { MyApiKeysManager } from '@/components/shared/MyApiKeysManager';
import { WorkspaceSectionHeader } from './WorkspaceSectionHeader';

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
    <div className="w-full space-y-6 animate-in fade-in duration-700">
      <WorkspaceSectionHeader
        kicker="Integrações"
        accent="cyan"
        title="Conexões e"
        titleAccent="Integrações"
        subtitle="Sincronização de dados da squad com ferramentas externas"
        action={
          <Button
            onClick={handleSaveAll}
            disabled={isSaving || loadingJira || loadingTdn}
            className="h-10 px-6 bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs uppercase tracking-wider rounded-xl shadow-md shadow-primary/20 gap-2 active:scale-95 transition-all"
          >
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Salvar Configurações
          </Button>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* JIRA SETTINGS */}
        <Card className="rounded-3xl border border-border/80 bg-card text-card-foreground shadow-xs p-6 md:p-8 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 blur-3xl rounded-full translate-x-1/2 -translate-y-1/2 pointer-events-none" />
          
          <div className="space-y-6 relative z-10">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-blue-600 flex items-center justify-center text-white shadow-md shadow-blue-600/20">
                  <Database className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-sm font-bold uppercase tracking-wider text-foreground">Jira Software</h3>
                  <p className="text-xs font-medium text-muted-foreground">Atlassian Cloud Sync</p>
                </div>
              </div>
              <Badge variant="outline" className="bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20 font-bold text-[9px] tracking-widest uppercase">
                v2.0 API
              </Badge>
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground ml-1">Domínio da Instância</Label>
                <div className="relative">
                   <Globe className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60" />
                   <Input 
                    value={jiraUrl}
                    onChange={(e) => setJiraUrl(e.target.value)}
                    placeholder="exemplo.atlassian.net"
                    className="h-11 pl-11 rounded-xl border-border bg-background font-medium text-sm focus-visible:ring-primary/20"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground ml-1">Personal Access Token (PAT)</Label>
                <div className="relative">
                   <ShieldCheck className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60" />
                   <Input 
                    type="password"
                    value={jiraToken}
                    onChange={(e) => setJiraToken(e.target.value)}
                    placeholder="••••••••••••••••"
                    className="h-11 pl-11 rounded-xl border-border bg-background font-medium text-sm focus-visible:ring-primary/20"
                  />
                </div>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-blue-500/10 border border-blue-500/20">
              <p className="text-xs text-blue-700 dark:text-blue-300 leading-relaxed font-medium">
                Utilizado para importar Histórias de Usuário e Critérios de Aceite para as sessões de Poker.
              </p>
            </div>
          </div>
        </Card>

        {/* TDN SETTINGS */}
        <Card className="rounded-3xl border border-border/80 bg-card text-card-foreground shadow-xs p-6 md:p-8 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/5 blur-3xl rounded-full translate-x-1/2 -translate-y-1/2 pointer-events-none" />
          
          <div className="space-y-6 relative z-10">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-cyan-500 flex items-center justify-center text-white shadow-md shadow-cyan-500/20">
                  <Globe className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-sm font-bold uppercase tracking-wider text-foreground">TDN / Confluence Wiki</h3>
                  <p className="text-xs font-medium text-muted-foreground">Technical Knowledge Hub</p>
                </div>
              </div>
              <Badge variant="outline" className="bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20 font-bold text-[9px] tracking-widest uppercase">
                Confluence
              </Badge>
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground ml-1">URL Base do TDN</Label>
                <div className="relative">
                   <Zap className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60" />
                   <Input 
                    value={tdnUrl}
                    onChange={(e) => setTdnUrl(e.target.value)}
                    placeholder="wiki.suaempresa.com"
                    className="h-11 pl-11 rounded-xl border-border bg-background font-medium text-sm focus-visible:ring-primary/20"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground ml-1">Personal Access Token (PAT)</Label>
                <div className="relative">
                   <ShieldCheck className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60" />
                   <Input 
                    type="password"
                    value={tdnToken}
                    onChange={(e) => setTdnToken(e.target.value)}
                    placeholder="••••••••••••••••"
                    className="h-11 pl-11 rounded-xl border-border bg-background font-medium text-sm focus-visible:ring-primary/20"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground ml-1">Espaço (Space)</Label>
                  <Input 
                    value={tdnSpace}
                    onChange={(e) => setTdnSpace(e.target.value)}
                    placeholder="Ex: PRO"
                    className="h-11 rounded-xl border-border bg-background font-medium text-sm focus-visible:ring-primary/20"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground ml-1">Rótulo (Label)</Label>
                  <Input 
                    value={tdnLabel}
                    onChange={(e) => setTdnLabel(e.target.value)}
                    placeholder="Ex: agile, space"
                    className="h-11 rounded-xl border-border bg-background font-medium text-sm focus-visible:ring-primary/20"
                  />
                </div>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-cyan-500/10 border border-cyan-500/20">
              <p className="text-xs text-cyan-700 dark:text-cyan-300 leading-relaxed font-medium">
                Permite buscar documentações técnicas da empresa e importá-las para sua Wiki local com um clique.
              </p>
            </div>
          </div>
        </Card>

      </div>

      {/* API KEYS — self-service, separado do grid Jira/TDN porque tem lista +
          formulário (mais alto), diferente das duas credenciais simples acima. */}
      <MyApiKeysManager />
    </div>
  );
}

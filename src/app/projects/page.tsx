"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { LoadingScreen } from '@/components/layout/LoadingScreen';

export default function ProjectsGovernancePage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/admin?tab=governance');
  }, [router]);

  return <LoadingScreen />;
}
        projectService.getAllProjects(),
        projectService.getHierarchy()
      ]);
      setProjects(allProjects);
      setHierarchy(hier);

      if (allProjects.length > 0) {
        // Seleciona preferencialmente DDWMISSI ou o primeiro da lista
        const defaultProj = allProjects.find(p => p.id.toUpperCase() === 'DDWMISSI') || allProjects[0];
        setSelectedProject(defaultProj);
        setSearchKey(defaultProj.id);
      } else {
        // Se ainda não houver nenhum, dispara sync inicial do DDWMISSI
        await handleSync('DDWMISSI');
      }
    } catch (err: any) {
      console.warn('Carregando mock inicial do projeto:', err);
      // Sincroniza DDWMISSI mock para inicializar
      await handleSync('DDWMISSI');
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async (keyToSync?: string) => {
    const key = (keyToSync || searchKey).trim().toUpperCase();
    if (!key) {
      toast({
        title: "Informe a chave do projeto",
        description: "Exemplo: DDWMISSI",
        variant: "destructive"
      });
      return;
    }

    setSyncing(true);
    try {
      const synced = await projectService.syncProjectProfields(key);
      setSelectedProject(synced);
      setSearchKey(synced.id);

      // Atualiza lista
      const updatedList = await projectService.getAllProjects();
      setProjects(updatedList);
      const updatedHier = await projectService.getHierarchy();
      setHierarchy(updatedHier);

      toast({
        title: "Projeto Sincronizado!",
        description: `Metadados de governança e papéis de ${synced.id} atualizados com sucesso via Profields.`,
      });
    } catch (err: any) {
      toast({
        title: "Erro na sincronização",
        description: err.message || "Não foi possível sincronizar o projeto do Jira.",
        variant: "destructive"
      });
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      <main className="flex-1 w-full p-4 sm:p-6 lg:p-8 space-y-6">
        
        {/* Top Header & Search Banner */}
        <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 rounded-2xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden">
          <div className="absolute right-0 top-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
          
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Badge className="bg-blue-500/20 text-blue-300 border-blue-400/30 hover:bg-blue-500/30">
                  <Building2 className="w-3.5 h-3.5 mr-1" /> Jira Profields Governança
                </Badge>
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
                Estrutura de Projetos & Lideranças
              </h1>
              <p className="text-slate-300 text-sm max-w-2xl">
                Configuração oficial e papéis corporativos extraídos da API do Jira Profields. 
                Os cargos aqui definidos alimentam automaticamente os acessos e permissões no Login do Agile Space.
              </p>
            </div>

            {/* Sincronizador de Projeto */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 bg-white/10 p-2 rounded-xl backdrop-blur-md border border-white/15">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <Input 
                  value={searchKey}
                  onChange={(e) => setSearchKey(e.target.value.toUpperCase())}
                  placeholder="Chave (ex: DDWMISSI)"
                  className="pl-9 bg-slate-950/40 border-white/20 text-white placeholder:text-slate-400 text-sm h-10 w-full sm:w-48"
                  onKeyDown={(e) => e.key === 'Enter' && handleSync()}
                />
              </div>
              <Button 
                onClick={() => handleSync()} 
                disabled={syncing}
                className="bg-blue-600 hover:bg-blue-500 text-white font-medium shadow-md transition-all"
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
                {syncing ? 'Sincronizando...' : 'Sincronizar Jira'}
              </Button>
            </div>
          </div>
        </div>

        {/* Seletor de Projetos Rápido */}
        {projects.length > 1 && (
          <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap mr-1">
              Projetos Disponíveis:
            </span>
            {projects.map((p) => (
              <button
                key={p.id}
                onClick={() => setSelectedProject(p)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap flex items-center gap-1.5 ${
                  selectedProject?.id === p.id 
                    ? 'bg-blue-600 text-white shadow-sm' 
                    : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800'
                }`}
              >
                <Briefcase className="w-3.5 h-3.5" />
                <span>{p.id}</span>
                <span className="text-slate-400 text-[10px]">({p.tribeName || 'Geral'})</span>
              </button>
            ))}
          </div>
        )}

        {/* Conteúdo Principal do Projeto - 4 Blocos da Imagem Profields */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Skeleton className="h-96 rounded-xl" />
            <Skeleton className="h-96 rounded-xl" />
            <Skeleton className="h-96 rounded-xl" />
          </div>
        ) : selectedProject ? (
          <div className="space-y-6">
            
            {/* Banner de Resumo da Governança */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400 flex items-center justify-center font-bold text-lg border border-blue-200 dark:border-blue-800">
                  {selectedProject.id.slice(0, 3)}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                      {selectedProject.name && selectedProject.name !== selectedProject.id 
                        ? selectedProject.name 
                        : `Projeto ${selectedProject.id}`}
                    </h2>
                    <Badge variant="secondary" className="font-mono text-xs">
                      {selectedProject.id}
                    </Badge>
                  </div>
                  <p className="text-xs text-slate-500 flex items-center gap-2 mt-0.5">
                    <span>Segmento: <strong>{selectedProject.segmentName || 'Não especificado'}</strong></span>
                    <span>•</span>
                    <span>Tribo: <strong>{selectedProject.tribeName || 'Geral'}</strong></span>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 self-end md:self-center">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => router.push('/login')}
                  className="text-xs border-blue-200 text-blue-700 dark:text-blue-400 dark:border-blue-900"
                >
                  <UserCheck className="w-3.5 h-3.5 mr-1.5" />
                  Testar Login de Membro
                </Button>
                <a
                  href={`https://jiraproducao.totvs.com.br/projects/${selectedProject.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center text-xs text-slate-500 hover:text-blue-600 transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5 mr-1" /> Ver no Jira
                </a>
              </div>
            </div>

            {/* GRID 3 COLUNAS - Layout idêntico ao Jira Profields TOTVS */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
              
              {/* COLUNA 1: Informações Gerais & Status e Números */}
              <div className="space-y-6">
                
                {/* BLOCO 1: Informações Gerais */}
                <Card className="border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                  <CardHeader className="bg-slate-50/70 dark:bg-slate-900/70 border-b border-slate-100 dark:border-slate-800 pb-3">
                    <CardTitle className="text-base font-semibold flex items-center gap-2 text-slate-900 dark:text-white">
                      <Building2 className="w-4 h-4 text-blue-600" />
                      Informações Gerais
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-4 space-y-4 text-sm">
                    <div>
                      <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                        Segmento Projeto
                      </span>
                      <p className="font-medium text-slate-800 dark:text-slate-200 mt-0.5">
                        {selectedProject.segmentName || '—'}
                      </p>
                    </div>

                    <div>
                      <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                        Localidade
                      </span>
                      <p className="font-medium text-slate-800 dark:text-slate-200 mt-0.5 flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-slate-400" />
                        {selectedProject.locality || '—'}
                      </p>
                    </div>

                    <div>
                      <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                        Tribo
                      </span>
                      <p className="font-medium text-slate-800 dark:text-slate-200 mt-0.5">
                        {selectedProject.tribeName || '—'}
                      </p>
                    </div>

                    <div>
                      <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                        Vice-Presidente
                      </span>
                      <p className="font-medium text-slate-800 dark:text-slate-200 mt-0.5">
                        {selectedProject.vicePresident || '—'}
                      </p>
                    </div>

                    <div>
                      <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                        VP
                      </span>
                      <p className="font-medium text-slate-800 dark:text-slate-200 mt-0.5">
                        {selectedProject.vpArea || '—'}
                      </p>
                    </div>
                  </CardContent>
                </Card>

                {/* BLOCO 3: Status e Números */}
                <Card className="border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                  <CardHeader className="bg-slate-50/70 dark:bg-slate-900/70 border-b border-slate-100 dark:border-slate-800 pb-3">
                    <CardTitle className="text-base font-semibold flex items-center gap-2 text-slate-900 dark:text-white">
                      <Activity className="w-4 h-4 text-emerald-600" />
                      Status e Números
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-4 space-y-4 text-sm">
                    <div>
                      <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                        Dev Team
                      </span>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-2xl font-bold text-slate-900 dark:text-white">
                          {selectedProject.devTeamSize ?? '—'}
                        </span>
                        <span className="text-xs text-slate-500">pessoas no DevTeam</span>
                      </div>
                    </div>

                    <div>
                      <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                        Status Projeto
                      </span>
                      <div className="mt-1">
                        <Badge className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-2.5 py-0.5 text-xs">
                          {selectedProject.status || 'EM ANDAMENTO'}
                        </Badge>
                      </div>
                    </div>

                    <div>
                      <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                        Data de Criação
                      </span>
                      <p className="font-medium text-slate-800 dark:text-slate-200 mt-0.5 flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        {selectedProject.creationDate || '—'}
                      </p>
                    </div>
                  </CardContent>
                </Card>

              </div>

              {/* COLUNA 2: BLOCO 2 - Pessoas & Papéis Oficiais */}
              <Card className="border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden lg:col-span-1">
                <CardHeader className="bg-slate-50/70 dark:bg-slate-900/70 border-b border-slate-100 dark:border-slate-800 pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base font-semibold flex items-center gap-2 text-slate-900 dark:text-white">
                      <Users className="w-4 h-4 text-indigo-600" />
                      Pessoas & Lideranças
                    </CardTitle>
                    <Badge variant="outline" className="text-[10px]">
                      {selectedProject.members?.length || 0} Atribuídos
                    </Badge>
                  </div>
                  <CardDescription className="text-xs">
                    Cargos mapeados diretamente do Profields
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-4 space-y-4">
                  {selectedProject.members && selectedProject.members.length > 0 ? (
                    selectedProject.members.map((member, idx) => (
                      <div 
                        key={member.id || idx}
                        className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-800/80 hover:border-slate-300 dark:hover:border-slate-700 transition-all flex items-start gap-3"
                      >
                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-500 to-blue-600 text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-sm">
                          {member.displayName?.charAt(0) || 'U'}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-1">
                            <span className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wide">
                              {member.roleName}
                            </span>
                            {member.leadership && (
                              <Badge className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20 text-[9px] px-1.5 py-0">
                                Liderança
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">
                            {member.displayName}
                          </p>
                          {member.email && (
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                              {member.email}
                            </p>
                          )}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="py-8 text-center text-slate-400 text-sm">
                      Nenhum membro atribuído diretamente neste layout.
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* COLUNA 3: BLOCO 4 - Campos de Validações de Fluxo */}
              <Card className="border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                <CardHeader className="bg-slate-50/70 dark:bg-slate-900/70 border-b border-slate-100 dark:border-slate-800 pb-3">
                  <CardTitle className="text-base font-semibold flex items-center gap-2 text-slate-900 dark:text-white">
                    <Sliders className="w-4 h-4 text-purple-600" />
                    Campos de Validações de Fluxo
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Parâmetros operacionais e automações configuradas
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-4 space-y-4 text-sm">
                  
                  <div className="border-b border-slate-100 dark:border-slate-800/60 pb-3">
                    <span className="text-xs font-semibold text-slate-600 dark:text-slate-300 block">
                      Documentação Automática TDN
                    </span>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Este projeto vai usar a automação para criar o documento técnico no TDN?
                    </p>
                    <div className="mt-1.5 flex items-center gap-1.5">
                      {selectedProject.autoTdnDoc ? (
                        <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-xs">
                          <CheckCircle2 className="w-3 h-3 mr-1" /> SIM
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-slate-500 text-xs">
                          <XCircle className="w-3 h-3 mr-1" /> NÃO / Vazio
                        </Badge>
                      )}
                    </div>
                  </div>

                  <div className="border-b border-slate-100 dark:border-slate-800/60 pb-3">
                    <span className="text-xs font-semibold text-slate-600 dark:text-slate-300 block">
                      Desativar Sub-tarefa Automática
                    </span>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Desabilita a criação automática de subtarefas padrão para o projeto.
                    </p>
                    <div className="mt-1.5 flex items-center gap-1.5">
                      {selectedProject.disableAutoSubtasks ? (
                        <Badge className="bg-blue-500/10 text-blue-600 border-blue-500/20 text-xs">
                          <CheckCircle2 className="w-3 h-3 mr-1" /> SIM
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-slate-500 text-xs">
                          <XCircle className="w-3 h-3 mr-1" /> NÃO / Vazio
                        </Badge>
                      )}
                    </div>
                  </div>

                  <div className="border-b border-slate-100 dark:border-slate-800/60 pb-3">
                    <span className="text-xs font-semibold text-slate-600 dark:text-slate-300 block">
                      Cria sub-tarefa específica
                    </span>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Campo para selecionar as subtarefas personalizadas a serem geradas.
                    </p>
                    <p className="text-xs font-medium text-slate-700 dark:text-slate-300 mt-1 bg-slate-50 dark:bg-slate-900 p-2 rounded border border-slate-100 dark:border-slate-800">
                      {selectedProject.specificSubtasks || 'Nenhuma subtarefa específica informada'}
                    </p>
                  </div>

                  <div className="border-b border-slate-100 dark:border-slate-800/60 pb-3">
                    <span className="text-xs font-semibold text-slate-600 dark:text-slate-300 block">
                      Expedição SAAS
                    </span>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Demandas não expedidas na Central de Download padrão da TOTVS.
                    </p>
                    <div className="mt-1.5 flex items-center gap-1.5">
                      {selectedProject.saasExpedition ? (
                        <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-xs">
                          <CheckCircle2 className="w-3 h-3 mr-1" /> SIM
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-slate-500 text-xs">
                          <XCircle className="w-3 h-3 mr-1" /> NÃO
                        </Badge>
                      )}
                    </div>
                  </div>

                  <div className="border-b border-slate-100 dark:border-slate-800/60 pb-3">
                    <span className="text-xs font-semibold text-slate-600 dark:text-slate-300 block">
                      Expedição Exclusiva Engenharia
                    </span>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Expedição do Desenvolvimento feito exclusivo pela Engenharia (GCAD).
                    </p>
                    <div className="mt-1.5">
                      {selectedProject.engineeringOnlyExpedition ? (
                        <Badge className="bg-purple-500/10 text-purple-600 border-purple-500/20 text-xs">
                          SIM
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-slate-500 text-xs">
                          NÃO
                        </Badge>
                      )}
                    </div>
                  </div>

                  <div>
                    <span className="text-xs font-semibold text-slate-600 dark:text-slate-300 block">
                      Apontamento Opcional
                    </span>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Caso o time não necessite a obrigatoriedade dos apontamentos de horas.
                    </p>
                    <div className="mt-1.5">
                      {selectedProject.optionalWorklog ? (
                        <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20 text-xs">
                          SIM (Opcional)
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-slate-500 text-xs">
                          NÃO (Obrigatório)
                        </Badge>
                      )}
                    </div>
                  </div>

                </CardContent>
              </Card>

            </div>

          </div>
        ) : (
          <div className="bg-white dark:bg-slate-900 rounded-xl p-12 text-center border border-slate-200 dark:border-slate-800">
            <Building2 className="w-12 h-12 mx-auto text-slate-400 mb-3" />
            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200">
              Nenhum projeto selecionado
            </h3>
            <p className="text-sm text-slate-500 max-w-md mx-auto mt-1 mb-4">
              Informe a chave do projeto Jira (ex: DDWMISSI) acima para importar os dados do Profields.
            </p>
            <Button onClick={() => handleSync('DDWMISSI')} className="bg-blue-600 hover:bg-blue-500 text-white">
              Sincronizar DDWMISSI
            </Button>
          </div>
        )}

      </main>

      <Footer />
    </div>
  );
}

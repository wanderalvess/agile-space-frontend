'use client';

import React from 'react';
import { 
  Sparkles, 
  Library,
  MessageSquare, 
  GitFork, 
  Users, 
  ShieldCheck,
  Search,
  Zap,
  Target,
  ArrowRight,
  GraduationCap
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useUserContext } from '@/context/UserContext';
import { ToolHubLayout } from '@/components/shared/ToolHubLayout';
import { PromptDashboard } from './components/Dashboard';
import { AgileSpinner } from '@/components/ui/AgileSpinner';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';

export default function PromptHubPage() {
  const router = useRouter();
  const { session, isLoading: authLoading } = useAuth();
  const { userProfile, setIsEditProfileOpen, mustOnboard, isPublicExploration, setIsPublicExploration } = useUserContext();

  const [showPublicOnly, setShowPublicOnly] = React.useState(false);

  React.useEffect(() => {
    document.title = `Biblioteca de Modelos | Espaço Ágil`;
    // Garantir que começamos sem exploração pública forçada ao entrar na página
    // a menos que o usuário clique explicitamente
    return () => {
      setIsPublicExploration(false);
    };
  }, [setIsPublicExploration]);

  // Se o usuário logou, desativa automaticamente a visualização de "somente público"
  React.useEffect(() => {
    if (session) {
      setShowPublicOnly(false);
      setIsPublicExploration(false);
    }
  }, [session, setIsPublicExploration]);

  const handleShowPublic = () => {
    setShowPublicOnly(true);
    setIsPublicExploration(true);
  };

  // 1. Loading State
  if (authLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <AgileSpinner size="lg" variant="indigo" />
      </div>
    );
  }

  // 2. Identity Gate Check
  if (mustOnboard && !showPublicOnly) {
    return (
      <div className="flex-1 min-h-screen bg-background flex items-center justify-center p-6 lg:p-16">
        <div className="max-w-xl w-full text-center space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-primary/10 rounded-full border border-primary/20 text-primary text-xs font-medium">
             <Zap className="h-3.5 w-3.5" />
             <span>Identificação de Squad Requerida</span>
          </div>
          
          <div className="space-y-3">
             <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground">
                Conecte seu Cargo e Squad
             </h1>
             <p className="text-sm sm:text-base font-normal text-muted-foreground leading-relaxed max-w-md mx-auto">
                Para acessar e compartilhar modelos com o seu time na Biblioteca de IA, informe seu cargo e sua squad.
             </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-left">
             <div className="p-5 bg-card border border-border rounded-xl space-y-2 shadow-xs">
                <ShieldCheck className="h-5 w-5 text-primary" />
                <h4 className="font-semibold text-foreground text-sm">Modelos por Função</h4>
                <p className="text-xs text-muted-foreground leading-relaxed">Libera bibliotecas e assistentes recomendados para o seu papel técnico.</p>
             </div>
             <div className="p-5 bg-card border border-border rounded-xl space-y-2 shadow-xs">
                <Users className="h-5 w-5 text-primary" />
                <h4 className="font-semibold text-foreground text-sm">Sincronia de Squad</h4>
                <p className="text-xs text-muted-foreground leading-relaxed">Compartilhe e reutilize prompts e automações criados pela sua equipe.</p>
             </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 items-center justify-center pt-2">
            <Button 
              onClick={() => {
                setIsPublicExploration(false);
                setIsEditProfileOpen(true);
              }}
              size="lg"
              className="h-11 px-8 rounded-xl font-medium text-sm group"
            >
               Completar Perfil <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
            </Button>
            <Button 
              onClick={handleShowPublic}
              variant="ghost"
              size="lg"
              className="h-11 text-muted-foreground hover:text-foreground font-medium text-sm"
            >
               Apenas Ver Modelos Públicos
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // 3. User Unauthenticated: Landing Page Hub
  if (!session && !showPublicOnly) {
    return (
      <ToolHubLayout
        title="Biblioteca de IA"
        description="O acervo da empresa para prompts, skills, agentes, Gems e iniciativas de IA — em um lugar só, fácil de achar e de reaproveitar."
        icon={<Library />}
        themeColor="blue"
        secondaryActionLabel="Explorar Biblioteca Pública"
        onSecondaryAction={handleShowPublic}
        hideHistory={true}
        hideJoinAction={true}
        tips={[
          { title: 'Ache em segundos', description: 'Busca por título, conteúdo, tag ou autor, com filtro por categoria e ordenação por uso real.', icon: <Search /> },
          { title: 'Oito categorias', description: 'Prompt, Skill, Agente, Gem, Instrução, Workflow, MCP e Recurso — cada uma com o formato de conteúdo certo.', icon: <Sparkles /> },
          { title: 'Duplique e adapte', description: 'Achou algo útil de outra squad? Faça uma cópia privada e ajuste ao seu contexto.', icon: <GitFork /> }
        ]}
        referenceSections={[
          {
            title: 'Como criar uma Skill',
            description: 'Tutorial em português: formato SKILL.md, regras do frontmatter, boas práticas e checklist antes de publicar.',
            icon: <GraduationCap />,
            label: 'Tutorial',
            onClick: () => router.push('/prompt-hub/tutorial')
          },
          {
            title: 'Explorar sem login',
            description: 'Veja o que o time já criou e validou antes de decidir entrar.',
            icon: <Target />,
            label: 'Acesso Público'
          }
        ]}
      />
    );
  }

  // 4. User Authenticated & Complete: Immersive Dashboard
  return <PromptDashboard userProfile={userProfile} isPublicView={showPublicOnly || !session} />;
}

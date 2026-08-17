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
import { useFirebase } from '@/firebase';
import { useUserContext } from '@/context/UserContext';
import { ToolHubLayout } from '@/components/shared/ToolHubLayout';
import { PromptDashboard } from './components/Dashboard';
import { EliteSpinner } from '@/components/ui/EliteSpinner';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';

export default function PromptHubPage() {
  const router = useRouter();
  const { user, isUserLoading: authLoading } = useFirebase();
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
    if (user) {
      setShowPublicOnly(false);
      setIsPublicExploration(false);
    }
  }, [user, setIsPublicExploration]);

  const handleShowPublic = () => {
    setShowPublicOnly(true);
    setIsPublicExploration(true);
  };

  // 1. Loading State
  if (authLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-white">
        <EliteSpinner size="lg" variant="indigo" />
      </div>
    );
  }

  // 2. Identity Gate Check
  if (mustOnboard && !showPublicOnly) {
    return (
      <div className="flex-1 min-h-screen bg-slate-900 flex items-center justify-center p-6 lg:p-20 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-cyan-500/10 blur-[120px] rounded-full -z-10" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-indigo-500/10 blur-[100px] rounded-full -z-10" />
        
        <div className="max-w-2xl w-full text-center space-y-12 animate-in fade-in slide-in-from-bottom-8 duration-1000">
          <div className="inline-flex items-center gap-3 px-4 py-2 bg-white/5 rounded-2xl border border-white/10 text-cyan-400">
             <Zap className="h-4 w-4" />
             <span className="text-[10px] font-black uppercase tracking-[0.3em]">Protocolo de Identidade Requerido</span>
          </div>
          
          <div className="space-y-4">
             <h1 className="text-5xl md:text-6xl font-black uppercase tracking-tighter italic text-white leading-none">
                Quase lá, <span className="text-white/40">Comandante.</span>
             </h1>
             <p className="text-lg font-medium text-slate-400 leading-relaxed max-w-lg mx-auto">
                Para acessar os modelos de squad da Biblioteca, precisamos saber qual é o seu **Cargo** e a sua **Squad**. 
             </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
             <div className="p-6 bg-white/5 border border-white/10 rounded-[2rem] text-left space-y-2">
                <ShieldCheck className="h-6 w-6 text-indigo-400" />
                <h4 className="font-black text-white italic uppercase tracking-tighter text-lg">Semântica de Cargo</h4>
                <p className="text-[10px] font-medium text-slate-500 leading-relaxed">Libera bibliotecas exclusivas para sua função profissional.</p>
             </div>
             <div className="p-6 bg-white/5 border border-white/10 rounded-[2rem] text-left space-y-2">
                <Users className="h-6 w-6 text-cyan-400" />
                <h4 className="font-black text-white italic uppercase tracking-tighter text-lg">Sincronia de Squad</h4>
                <p className="text-[10px] font-medium text-slate-500 leading-relaxed">Permite compartilhar modelos síncronos com seu time.</p>
             </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 items-center justify-center">
            <Button 
              onClick={() => {
                setIsPublicExploration(false);
                setIsEditProfileOpen(true);
              }}
              size="lg"
              className="h-16 px-12 bg-white text-slate-900 hover:bg-slate-100 rounded-2xl font-black uppercase text-xs tracking-widest shadow-2xl transition-all active:scale-95 group"
            >
               Completar Perfil <ArrowRight className="ml-3 h-5 w-5 group-hover:translate-x-1 transition-transform" />
            </Button>
            <Button 
              onClick={handleShowPublic}
              variant="ghost"
              className="text-white/40 hover:text-white font-black uppercase text-[10px] tracking-widest"
            >
               Apenas Ver Modelos Públicos
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // 3. User Unauthenticated: Landing Page Hub
  if (!user && !showPublicOnly) {
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
  return <PromptDashboard userProfile={userProfile} isPublicView={showPublicOnly || !user} />;
}

'use client';

import { useRouter } from 'next/navigation';
import { motion, type Variants } from 'framer-motion';
import { HeroWidget } from './HeroWidget';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import {
  WalletCards,
  LayoutDashboard,
  Eye,
  Terminal,
  ChevronRight,
  GitBranch,
  Sparkles,
  BookOpen,
  FileText,
  Lock,
  ArrowUpRight,
  Users2,
  Calendar,
  AlertCircle,
  Zap,
  Fingerprint,
  Database,
  ShieldCheck,
  Binary,
  Clock,
  Braces,
  Activity
} from 'lucide-react';

export function BentoGrid() {
  const router = useRouter();

  const devtoolsButtons = [
    {
      title: 'Base64 / URL',
      desc: 'Codificar & Decodificar',
      route: '/devtools/base64',
      icon: Zap,
      color: 'text-orange-500 bg-orange-500/10 border-orange-500/20 hover:border-orange-500/40 hover:bg-orange-500/5',
    },
    {
      title: 'Gerador UUID',
      desc: 'Criar chaves exclusivas',
      route: '/devtools/uuid-generator',
      icon: Fingerprint,
      color: 'text-rose-500 bg-rose-500/10 border-rose-500/20 hover:border-rose-500/40 hover:bg-rose-500/5',
    },
    {
      title: 'Secret Vault',
      desc: 'Criptografia AES local',
      route: '/devtools/secret-vault',
      icon: Lock,
      color: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20 hover:border-emerald-500/40 hover:bg-emerald-500/5',
    },
    {
      title: 'Formatador SQL',
      desc: 'Sanitizar instruções',
      route: '/devtools/sql-formatter',
      icon: Database,
      color: 'text-blue-500 bg-blue-500/10 border-blue-500/20 hover:border-blue-500/40 hover:bg-blue-500/5',
    },
    {
      title: 'Decodificador JWT',
      desc: 'Análise local de tokens',
      route: '/devtools/jwt-inspector',
      icon: ShieldCheck,
      color: 'text-cyan-500 bg-cyan-500/10 border-cyan-500/20 hover:border-cyan-500/40 hover:bg-cyan-500/5',
    },
    {
      title: 'Laboratório Regex',
      desc: 'Validar buscas complexas',
      route: '/devtools/regex-lab',
      icon: Binary,
      color: 'text-fuchsia-500 bg-fuchsia-500/10 border-fuchsia-500/20 hover:border-fuchsia-500/40 hover:bg-fuchsia-500/5',
    },
    {
      title: 'Interpretador Cron',
      desc: 'Traduzir agendamentos',
      route: '/devtools/cron-decoder',
      icon: Clock,
      color: 'text-amber-500 bg-amber-500/10 border-amber-500/20 hover:border-amber-500/40 hover:bg-amber-500/5',
    },
    {
      title: 'Validador JSON',
      desc: 'Sanitizar payloads',
      route: '/devtools/json',
      icon: Braces,
      color: 'text-indigo-500 bg-indigo-500/10 border-indigo-500/20 hover:border-indigo-500/40 hover:bg-indigo-500/5',
    }
  ];

  // Container animation
  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
      },
    },
  };

  const itemVariants: Variants = {
    hidden: { y: 20, opacity: 0 },
    show: { y: 0, opacity: 1, transition: { type: 'spring', stiffness: 100, damping: 15 } },
  };

  return (
    <motion.section
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-6 items-stretch w-full"
    >
      
      {/* 1. HERO — Greeting + Timesheet unified (col-span-12) */}
      <motion.div variants={itemVariants} className="lg:col-span-12 col-span-1">
        <HeroWidget />
      </motion.div>

      {/* 3. SCRUM POKER (col-span-4) - Tall & Interactive */}
      <motion.div
        variants={itemVariants}
        className="lg:col-span-4 md:col-span-1 col-span-1"
        whileHover="hover"
      >
        <Card 
          onClick={() => router.push('/room')}
          className="group relative border border-slate-200 dark:border-slate-800 bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl rounded-[2.5rem] p-7 shadow-lg hover:shadow-2xl dark:shadow-none hover:border-orange-500/40 dark:hover:border-orange-500/40 transition-all duration-500 cursor-pointer flex flex-col justify-between h-full min-h-[280px] overflow-hidden"
        >
          {/* Card Glow */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500/5 dark:bg-orange-500/10 rounded-full blur-2xl group-hover:scale-125 transition-transform duration-700 pointer-events-none" />
          
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="w-10 h-10 bg-orange-500/10 rounded-xl flex items-center justify-center shrink-0 border border-orange-500/20 group-hover:scale-110 transition-transform duration-300">
                <WalletCards className="h-5 w-5 text-primary" />
              </div>
              <span className="text-[9px] font-black text-slate-500 dark:text-slate-500 uppercase tracking-widest bg-slate-50 dark:bg-slate-950 px-2.5 py-1 rounded-full border border-slate-200 dark:border-slate-800/80">Síncrono/Assíncrono</span>
            </div>
            
            <h3 className="text-xl font-black uppercase tracking-tight text-slate-950 dark:text-slate-50 mb-2 group-hover:text-primary transition-colors flex items-center gap-1.5">
              Scrum Poker <ArrowUpRight className="h-4 w-4 opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all duration-300 text-primary" />
            </h3>
            <p className="text-[13px] font-medium text-slate-500 dark:text-slate-400 leading-relaxed">
              Estime o esforço técnico de histórias e tarefas com consenso inteligente por papel em tempo real.
            </p>
          </div>

          {/* Interactive Stacked Cards Visual Mock */}
          <div className="relative h-24 my-3 flex items-center justify-center">
            {/* Card 1 (?) */}
            <motion.div 
              variants={{
                hover: { rotate: -15, x: -30, y: -5, scale: 1.05 }
              }}
              transition={{ type: 'spring', stiffness: 200, damping: 12 }}
              className="absolute w-14 h-20 bg-white dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 shadow-md flex items-center justify-center font-black text-slate-400 dark:text-slate-600 text-xl font-headline select-none z-10"
            >
              ?
            </motion.div>

            {/* Card 2 (8) */}
            <motion.div 
              variants={{
                hover: { rotate: 15, x: 30, y: -5, scale: 1.05 }
              }}
              transition={{ type: 'spring', stiffness: 200, damping: 12 }}
              className="absolute w-14 h-20 bg-white dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 shadow-md flex items-center justify-center font-black text-slate-450 dark:text-slate-505 text-xl font-headline select-none z-10"
            >
              8
            </motion.div>

            {/* Card 3 (5) - Centered & Glowing */}
            <motion.div 
              variants={{
                hover: { scale: 1.12, y: -8 }
              }}
              transition={{ type: 'spring', stiffness: 200, damping: 12 }}
              className="absolute w-15 h-22 bg-gradient-to-br from-primary to-orange-600 rounded-xl shadow-xl shadow-primary/20 flex flex-col items-center justify-between p-2.5 font-black text-white text-2xl font-headline select-none z-20 border border-primary/30"
            >
              <span className="text-[9px] font-bold self-start leading-none opacity-80">5</span>
              <span className="leading-none mt-1">5</span>
              <span className="text-[9px] font-bold self-end leading-none opacity-80 rotate-180">5</span>
            </motion.div>
          </div>

          <Button
            size="sm"
            className="w-full h-10 bg-primary hover:bg-orange-600 text-white font-extrabold uppercase text-[10px] tracking-wider rounded-xl transition-all border-none"
          >
            Votar Agora
          </Button>
        </Card>
      </motion.div>

      {/* 3. RETROSPECTIVA (col-span-4) - Interactive Stickies */}
      <motion.div
        variants={itemVariants}
        className="lg:col-span-4 md:col-span-1 col-span-1"
        whileHover="hover"
      >
        <Card 
          onClick={() => router.push('/retro')}
          className="group relative border border-slate-200 dark:border-slate-800 bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl rounded-[2.5rem] p-7 shadow-lg hover:shadow-2xl dark:shadow-none hover:border-emerald-500/40 dark:hover:border-emerald-500/40 transition-all duration-500 cursor-pointer flex flex-col justify-between h-full min-h-[300px] overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 dark:bg-emerald-500/10 rounded-full blur-2xl group-hover:scale-125 transition-transform duration-700 pointer-events-none" />
          
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="w-10 h-10 bg-emerald-500/10 rounded-xl flex items-center justify-center shrink-0 border border-emerald-500/20 group-hover:scale-110 transition-transform duration-300">
                <LayoutDashboard className="h-5 w-5 text-emerald-500" />
              </div>
              <span className="text-[9px] font-black text-slate-500 dark:text-slate-500 uppercase tracking-widest bg-slate-50 dark:bg-slate-950 px-2.5 py-1 rounded-full border border-slate-200 dark:border-slate-800/80">Cerimônia</span>
            </div>
            
            <h3 className="text-xl font-black uppercase tracking-tight text-slate-950 dark:text-slate-50 mb-2 group-hover:text-emerald-500 transition-colors flex items-center gap-1.5">
              Retrospectiva <ArrowUpRight className="h-4 w-4 opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all duration-300 text-emerald-500" />
            </h3>
            <p className="text-[13px] font-medium text-slate-500 dark:text-slate-400 leading-relaxed">
              Reúna o time para avaliar a sprint, votar nos pontos críticos e gerar planos de ação integrados.
            </p>
          </div>

          {/* Interactive Stacked Sticky Notes Visual Mock */}
          <div className="relative h-24 my-2 flex items-center justify-center">
            {/* Note 1 (Rose/Improve) */}
            <motion.div 
              variants={{
                hover: { rotate: -18, x: -35, y: -2, scale: 1.05 }
              }}
              className="absolute w-20 h-20 bg-rose-50/90 dark:bg-rose-950/20 rounded-xl border border-rose-100 dark:border-rose-900/30 p-2 shadow-sm flex flex-col justify-between z-10"
            >
              <span className="text-[7px] font-black uppercase tracking-wider text-rose-500 leading-none">Melhorar</span>
              <p className="text-[7.5px] font-bold text-rose-700/80 dark:text-rose-450 leading-tight">Falta de Definition of Ready</p>
            </motion.div>

            {/* Note 2 (Amber/Action) */}
            <motion.div 
              variants={{
                hover: { rotate: 18, x: 35, y: 5, scale: 1.05 }
              }}
              className="absolute w-20 h-20 bg-amber-50/90 dark:bg-amber-950/20 rounded-xl border border-amber-100 dark:border-amber-900/30 p-2 shadow-sm flex flex-col justify-between z-10"
            >
              <span className="text-[7px] font-black uppercase tracking-wider text-amber-500 leading-none">Ação</span>
              <p className="text-[7.5px] font-bold text-amber-700/80 dark:text-amber-450 leading-tight">Refinar DoD no Jira</p>
            </motion.div>

            {/* Note 3 (Emerald/Good) - Center */}
            <motion.div 
              variants={{
                hover: { scale: 1.1, y: -8 }
              }}
              className="absolute w-22 h-22 bg-emerald-50 dark:bg-emerald-950/30 rounded-xl border border-emerald-200 dark:border-emerald-800 p-2.5 shadow-md flex flex-col justify-between z-20"
            >
              <span className="text-[8px] font-black uppercase tracking-wider text-emerald-500 leading-none">Correu Bem</span>
              <p className="text-[9px] font-extrabold text-emerald-700 dark:text-emerald-400 leading-tight">Comunicação e apoio técnico da squad</p>
            </motion.div>
          </div>

          <Button
            size="sm"
            className="w-full h-10 bg-emerald-500 hover:bg-emerald-600 text-white font-extrabold uppercase text-[10px] tracking-wider rounded-xl transition-all border-none"
          >
            Iniciar Retro
          </Button>
        </Card>
      </motion.div>

      {/* 4. DAILY FLOW (col-span-4) - Sincronização e Impedimentos */}
      <motion.div
        variants={itemVariants}
        className="lg:col-span-4 md:col-span-1 col-span-1"
        whileHover="hover"
      >
        <Card 
          onClick={() => router.push('/squad?tab=daily')}
          className="group relative border border-slate-200 dark:border-slate-800 bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl rounded-[2.5rem] p-7 shadow-lg hover:shadow-2xl dark:shadow-none hover:border-cyan-500/40 dark:hover:border-cyan-500/40 transition-all duration-500 cursor-pointer flex flex-col justify-between h-full min-h-[300px] overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/5 dark:bg-cyan-500/10 rounded-full blur-2xl group-hover:scale-125 transition-transform duration-700 pointer-events-none" />
          
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="w-10 h-10 bg-cyan-500/10 rounded-xl flex items-center justify-center shrink-0 border border-cyan-500/20 group-hover:scale-110 transition-transform duration-300">
                <Users2 className="h-5 w-5 text-cyan-500" />
              </div>
              <span className="text-[9px] font-black text-slate-500 dark:text-slate-500 uppercase tracking-widest bg-slate-50 dark:bg-slate-950 px-2.5 py-1 rounded-full border border-slate-200 dark:border-slate-800/80">Diário</span>
            </div>
            
            <h3 className="text-xl font-black uppercase tracking-tight text-slate-950 dark:text-slate-50 mb-2 group-hover:text-cyan-500 transition-colors flex items-center gap-1.5">
              Daily Flow <ArrowUpRight className="h-4 w-4 opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all duration-300 text-cyan-500" />
            </h3>
            <p className="text-[13px] font-medium text-slate-500 dark:text-slate-400 leading-relaxed">
              Mural de sincronização assíncrona. Acompanhe status, metas da sprint e bloqueios.
            </p>
          </div>

          {/* Daily Mockup Stats */}
          <div className="my-4 space-y-2">
            <div className="flex items-center justify-between bg-slate-50/80 dark:bg-slate-950/40 border border-slate-200/60 dark:border-slate-800/60 rounded-xl p-2.5">
              <div className="flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <span className="text-[10px] font-extrabold uppercase text-slate-700 dark:text-slate-300">Status da Squad</span>
              </div>
              <span className="text-[9px] font-black text-emerald-600 dark:text-emerald-400 uppercase">8/10 Sincronizados</span>
            </div>

            <div className="flex items-center justify-between bg-slate-50/80 dark:bg-slate-950/40 border border-slate-200/60 dark:border-slate-800/60 rounded-xl p-2.5">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-3.5 w-3.5 text-rose-500" />
                <span className="text-[10px] font-extrabold uppercase text-slate-700 dark:text-slate-300">Impedimentos ativos</span>
              </div>
              <span className="text-[9px] font-black bg-rose-500/10 text-rose-500 border border-rose-500/20 px-2 py-0.5 rounded-md">2 Críticos</span>
            </div>
          </div>

          <Button
            size="sm"
            className="w-full h-10 bg-cyan-600 hover:bg-cyan-700 text-white font-extrabold uppercase text-[10px] tracking-wider rounded-xl transition-all border-none"
          >
            Abrir Daily
          </Button>
        </Card>
      </motion.div>

      {/* 5. SPRINT SHOWCASE (col-span-4) - Cinematic Review ticket */}
      <motion.div
        variants={itemVariants}
        className="lg:col-span-4 md:col-span-1 col-span-1"
        whileHover="hover"
      >
        <Card 
          onClick={() => router.push('/showcase')}
          className="group relative border border-slate-200 dark:border-slate-800 bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl rounded-[2.5rem] p-7 shadow-lg hover:shadow-2xl dark:shadow-none hover:border-violet-500/40 dark:hover:border-violet-500/40 transition-all duration-500 cursor-pointer flex flex-col justify-between h-full min-h-[300px] overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-violet-500/5 dark:bg-violet-500/10 rounded-full blur-2xl group-hover:scale-125 transition-transform duration-700 pointer-events-none" />
          
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="w-10 h-10 bg-violet-500/10 rounded-xl flex items-center justify-center shrink-0 border border-violet-500/20 group-hover:scale-110 transition-transform duration-300">
                <Eye className="h-5 w-5 text-violet-500" />
              </div>
              <span className="text-[9px] font-black text-slate-500 dark:text-slate-500 uppercase tracking-widest bg-slate-50 dark:bg-slate-950 px-2.5 py-1 rounded-full border border-slate-200 dark:border-slate-800/80">Showcase</span>
            </div>
            
            <h3 className="text-xl font-black uppercase tracking-tight text-slate-950 dark:text-slate-50 mb-2 group-hover:text-violet-500 transition-colors flex items-center gap-1.5">
              Review / Vitrine <ArrowUpRight className="h-4 w-4 opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all duration-300 text-violet-500" />
            </h3>
            <p className="text-[13px] font-medium text-slate-500 dark:text-slate-400 leading-relaxed">
              Exibição cinematográfica de entregas. Demonstre novas features com cards estéticos e metas batidas.
            </p>
          </div>

          {/* Cinematic Ticket Graphic */}
          <div className="my-3 flex justify-center">
            <div className="w-full max-w-[200px] border border-dashed border-violet-500/30 bg-gradient-to-r from-violet-950/10 to-violet-900/10 dark:from-violet-950/20 dark:to-violet-900/20 rounded-2xl p-3 flex flex-col justify-between relative overflow-hidden shadow-inner h-20">
              <div className="flex justify-between items-start">
                <div>
                  <span className="block text-[6.5px] font-black uppercase tracking-widest text-violet-400">Próximo Showcase</span>
                  <span className="block text-[11px] font-extrabold text-slate-850 dark:text-slate-200 mt-1 uppercase tracking-tight">Squad Elite Alpha</span>
                </div>
                <Calendar className="h-3.5 w-3.5 text-violet-500 opacity-60" />
              </div>
              <div className="flex justify-between items-end border-t border-slate-200/40 dark:border-slate-800/40 pt-2.5 mt-2">
                <span className="text-[7px] font-black font-mono tracking-widest text-violet-400">CODE: AS-S24</span>
                <span className="text-[7.5px] font-black bg-violet-500 text-white px-2 py-0.5 rounded-full uppercase tracking-wider scale-90">Teatro</span>
              </div>
            </div>
          </div>

          <Button
            size="sm"
            className="w-full h-10 bg-violet-600 hover:bg-violet-700 text-white font-extrabold uppercase text-[10px] tracking-wider rounded-xl transition-all border-none"
          >
            Acessar Vitrine
          </Button>
        </Card>
      </motion.div>

      {/* 6. JOLT SANDBOX (col-span-4) - Interactive JSON transformations mockup */}
      <motion.div
        variants={itemVariants}
        className="lg:col-span-4 md:col-span-1 col-span-1"
        whileHover="hover"
      >
        <Card 
          onClick={() => router.push('/jolt')}
          className="group relative border border-slate-200 dark:border-slate-800 bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl rounded-[2.5rem] p-7 shadow-lg hover:shadow-2xl dark:shadow-none hover:border-blue-500/40 dark:hover:border-blue-500/40 transition-all duration-500 cursor-pointer flex flex-col justify-between h-full min-h-[300px] overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 dark:bg-blue-500/10 rounded-full blur-2xl group-hover:scale-125 transition-transform duration-700 pointer-events-none" />
          
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="w-10 h-10 bg-blue-500/10 rounded-xl flex items-center justify-center shrink-0 border border-blue-500/20 group-hover:scale-110 transition-transform duration-300">
                <Terminal className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <span className="text-[9px] font-black text-slate-500 dark:text-slate-500 uppercase tracking-widest bg-slate-50 dark:bg-slate-950 px-2.5 py-1 rounded-full border border-slate-200 dark:border-slate-800/80">Jolt Parser</span>
            </div>
            
            <h3 className="text-xl font-black uppercase tracking-tight text-slate-950 dark:text-slate-50 mb-2 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors flex items-center gap-1.5">
              Sandbox Jolt <ArrowUpRight className="h-4 w-4 opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all duration-300 text-blue-600 dark:text-blue-400" />
            </h3>
            <p className="text-[13px] font-medium text-slate-500 dark:text-slate-400 leading-relaxed">
              Motor local de mapeamento. Transforme a estrutura de payloads JSON de forma declarativa e síncrona.
            </p>
          </div>

          {/* Code Sandbox Mockup */}
          <div className="my-3 rounded-xl bg-slate-950 p-2.5 border border-slate-800 font-mono text-[8px] text-emerald-400 flex flex-col justify-between h-20 shadow-inner relative">
            <span className="absolute top-1 right-2 text-[6.5px] font-black uppercase text-slate-600 tracking-wider">JSON Input</span>
            <div className="space-y-0.5 leading-none">
              <div><span className="text-purple-400">1</span> <span className="text-slate-500">&#123;</span></div>
              <div><span className="text-purple-400">2</span>   <span className="text-cyan-400">"status"</span>: <span className="text-orange-400">"SUCCESS"</span>,</div>
              <div><span className="text-purple-400">3</span>   <span className="text-cyan-400">"tasks"</span>: <span className="text-slate-500">[</span> <span className="text-slate-400">...</span> <span className="text-slate-500">]</span></div>
              <div><span className="text-purple-400">4</span> <span className="text-slate-500">&#125;</span></div>
            </div>
            <div className="flex items-center justify-between border-t border-slate-800 pt-1.5 mt-1 text-[7.5px] text-slate-550 font-bold uppercase">
              <span className="text-blue-500">Transform &gt;</span>
              <span className="text-slate-500 font-mono">100% Client-Side</span>
            </div>
          </div>

          <Button
            size="sm"
            className="w-full h-10 bg-blue-600 hover:bg-blue-700 text-white font-extrabold uppercase text-[10px] tracking-wider rounded-xl transition-all border-none"
          >
            Abrir Sandbox
          </Button>
        </Card>
      </motion.div>

      {/* 7. DEVTOOLS CENTRAL (col-span-4) - Ao lado do Sandbox Jolt */}
      <motion.div
        variants={itemVariants}
        className="lg:col-span-4 md:col-span-1 col-span-1"
      >
        <Card className="border border-slate-200 dark:border-slate-800 bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl rounded-[2.5rem] p-7 shadow-lg flex flex-col justify-between h-full min-h-[300px] hover:shadow-2xl dark:hover:shadow-none hover:border-teal-500/40 dark:hover:border-teal-500/40 transition-all duration-500 overflow-hidden relative">
          {/* Glow */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-teal-500/5 dark:bg-teal-500/10 rounded-full blur-2xl group-hover:scale-125 transition-transform duration-700 pointer-events-none" />

          <div className="relative z-10 flex flex-col h-full">
            {/* Header */}
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-teal-500/10 rounded-xl flex items-center justify-center shrink-0 border border-teal-500/20">
                  <Terminal className="h-5 w-5 text-teal-500" />
                </div>
                <div>
                  <h3 className="text-xl font-black uppercase tracking-tight text-slate-950 dark:text-slate-50">
                    DevTools Hub
                  </h3>
                  <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-500 mt-0.5 leading-none">
                    Utilitários rápidos offline
                  </p>
                </div>
              </div>
              <span className="text-[9px] font-black text-slate-500 dark:text-slate-500 uppercase tracking-widest bg-slate-50 dark:bg-slate-950 px-2.5 py-1 rounded-full border border-slate-200 dark:border-slate-800/80 shrink-0">
                20+
              </span>
            </div>

            {/* Quick Access — 2-col grid, first 4 tools */}
            <div className="grid grid-cols-2 gap-2.5 my-2 flex-1">
              {devtoolsButtons.slice(0, 4).map((tool, idx) => {
                const Icon = tool.icon;
                return (
                  <button
                    key={idx}
                    onClick={() => router.push(tool.route)}
                    className="flex items-center gap-2.5 p-3 rounded-2xl bg-white/70 dark:bg-slate-950/40 border border-slate-200/60 dark:border-slate-800/60 hover:border-teal-500/40 hover:bg-teal-500/5 shadow-sm active:scale-95 transition-all text-left group/btn"
                  >
                    <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center shrink-0 group-hover/btn:scale-110 transition-transform duration-300", tool.color)}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] font-black uppercase tracking-tight text-slate-900 dark:text-slate-100 leading-none truncate">{tool.title}</p>
                      <p className="text-[8px] font-bold text-slate-500 dark:text-slate-500 mt-1 truncate">{tool.desc}</p>
                    </div>
                  </button>
                );
              })}
            </div>

            <Button
              size="sm"
              className="w-full mt-4 h-10 bg-teal-600 hover:bg-teal-700 text-white font-extrabold uppercase text-[10px] tracking-wider rounded-xl active:scale-95 transition-all border-none"
              onClick={() => router.push('/devtools')}
            >
              Ver todas as utilidades
            </Button>
          </div>
        </Card>
      </motion.div>

      {/* 8. SQUAD PULSE (col-span-4) - Dashboard de produtividade via Jira */}
      <motion.div
        variants={itemVariants}
        className="lg:col-span-4 md:col-span-1 col-span-1"
        whileHover="hover"
      >
        <Card
          onClick={() => router.push('/squad')}
          className="group relative border border-slate-200 dark:border-slate-800 bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl rounded-[2.5rem] p-7 shadow-lg hover:shadow-2xl dark:shadow-none hover:border-indigo-500/40 dark:hover:border-indigo-500/40 transition-all duration-500 cursor-pointer flex flex-col justify-between h-full min-h-[300px] overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 dark:bg-indigo-500/10 rounded-full blur-2xl group-hover:scale-125 transition-transform duration-700 pointer-events-none" />

          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="w-10 h-10 bg-indigo-500/10 rounded-xl flex items-center justify-center shrink-0 border border-indigo-500/20 group-hover:scale-110 transition-transform duration-300">
                <Activity className="h-5 w-5 text-indigo-500" />
              </div>
              <span className="text-[9px] font-black text-slate-500 dark:text-slate-500 uppercase tracking-widest bg-slate-50 dark:bg-slate-950 px-2.5 py-1 rounded-full border border-slate-200 dark:border-slate-800/80">Novo</span>
            </div>

            <h3 className="text-xl font-black uppercase tracking-tight text-slate-950 dark:text-slate-50 mb-2 group-hover:text-indigo-500 transition-colors flex items-center gap-1.5">
              Squad Pulse <ArrowUpRight className="h-4 w-4 opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all duration-300 text-indigo-500" />
            </h3>
            <p className="text-[13px] font-medium text-slate-500 dark:text-slate-400 leading-relaxed">
              Produtividade do time sincronizada com o Jira: sprint atual, itens parados e proporção de bugs.
            </p>
          </div>

          <Button
            size="sm"
            className="w-full h-10 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold uppercase text-[10px] tracking-wider rounded-xl transition-all border-none"
          >
            Abrir Squad Pulse
          </Button>
        </Card>
      </motion.div>

    </motion.section>
  );
}

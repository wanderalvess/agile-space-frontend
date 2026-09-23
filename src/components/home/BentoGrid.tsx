'use client';

import { useRouter } from 'next/navigation';
import { motion, type Variants } from 'framer-motion';
import { HeroWidget } from './HeroWidget';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
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
  ArrowUpRight,
  Calendar,
  Clock,
  Activity,
  Gauge,
  TrendingDown
} from 'lucide-react';

export function BentoGrid() {
  const router = useRouter();

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
              className="absolute w-14 h-20 bg-white dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 shadow-md flex items-center justify-center font-black text-slate-400 dark:text-slate-500 text-xl font-headline select-none z-10"
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
                  <span className="block text-[11px] font-extrabold text-slate-800 dark:text-slate-200 mt-1 uppercase tracking-tight">Squad Elite Alpha</span>
                </div>
                <Calendar className="h-3.5 w-3.5 text-violet-500 opacity-60" />
              </div>
              <div className="flex justify-between items-end border-t border-slate-200/40 dark:border-slate-800/40 pt-2.5 mt-2">
                <span className="text-[7px] font-black font-code tracking-widest text-violet-400">CODE: AS-S24</span>
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
          <div className="my-3 rounded-xl bg-slate-950 p-2.5 border border-slate-800 font-code text-[8px] text-emerald-400 flex flex-col justify-between h-20 shadow-inner relative">
            <span className="absolute top-1 right-2 text-[6.5px] font-black uppercase text-slate-600 tracking-wider">JSON Input</span>
            <div className="space-y-0.5 leading-none">
              <div><span className="text-purple-400">1</span> <span className="text-slate-500">&#123;</span></div>
              <div><span className="text-purple-400">2</span>   <span className="text-cyan-400">"status"</span>: <span className="text-orange-400">"SUCCESS"</span>,</div>
              <div><span className="text-purple-400">3</span>   <span className="text-cyan-400">"tasks"</span>: <span className="text-slate-500">[</span> <span className="text-slate-400">...</span> <span className="text-slate-500">]</span></div>
              <div><span className="text-purple-400">4</span> <span className="text-slate-500">&#125;</span></div>
            </div>
            <div className="flex items-center justify-between border-t border-slate-800 pt-1.5 mt-1 text-[7.5px] text-slate-500 font-bold uppercase">
              <span className="text-blue-500">Transform &gt;</span>
              <span className="text-slate-500 font-code">100% Client-Side</span>
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

      {/* 8. SQUAD PULSE (col-span-12) - Dashboard de produtividade via Jira */}
      <motion.div
        variants={itemVariants}
        className="lg:col-span-12 md:col-span-2 col-span-1"
        whileHover="hover"
      >
        <Card
          onClick={() => router.push('/squad')}
          className="group relative border border-slate-200 dark:border-slate-800 bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl rounded-[2.5rem] p-7 md:p-8 shadow-lg hover:shadow-2xl dark:shadow-none hover:border-indigo-500/40 dark:hover:border-indigo-500/40 transition-all duration-500 cursor-pointer overflow-hidden flex flex-col sm:flex-row sm:items-center justify-between gap-6"
        >
          <div className="absolute top-0 right-0 w-48 h-48 bg-indigo-500/5 dark:bg-indigo-500/10 rounded-full blur-3xl group-hover:scale-125 transition-transform duration-700 pointer-events-none" />

          <div className="flex flex-col sm:flex-row sm:items-center gap-5 relative z-10 max-w-3xl">
            <div className="w-12 h-12 bg-indigo-500/10 rounded-2xl flex items-center justify-center shrink-0 border border-indigo-500/20 group-hover:scale-110 transition-transform duration-300">
              <Activity className="h-6 w-6 text-indigo-500" />
            </div>
            <div>
              <div className="flex items-center gap-2.5 mb-1.5">
                <h3 className="text-xl font-black uppercase tracking-tight text-slate-950 dark:text-slate-50 group-hover:text-indigo-500 transition-colors flex items-center gap-1.5">
                  Squad Pulse <ArrowUpRight className="h-4 w-4 opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all duration-300 text-indigo-500" />
                </h3>
                <span className="text-[9px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest bg-indigo-500/10 px-2.5 py-0.5 rounded-full border border-indigo-500/20">
                  Hub 360º
                </span>
              </div>
              <p className="text-[13px] font-medium text-slate-500 dark:text-slate-400 leading-relaxed">
                Produtividade do time sincronizada com o Jira: sprint atual, quadro scrum, timeline de planos e capacidade da equipe.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0 relative z-10">
            <Button
              size="sm"
              className="h-10 px-6 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold uppercase text-[10px] tracking-wider rounded-xl transition-all border-none"
            >
              Abrir Squad Pulse
            </Button>
          </div>
        </Card>
      </motion.div>

    </motion.section>
  );
}

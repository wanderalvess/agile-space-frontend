"use client";

import React from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Footer } from '@/components/layout/Footer';
import { 
  ArrowLeft,
  Rocket,
  Shield,
  Lock,
  Eye,
  Server,
  FileCheck,
  Users,
  Globe,
  CloudOff,
  KeyRound,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  Database,
  Fingerprint,
  Building2,
  Scale,
  Sparkles,
  ExternalLink,
  HelpCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { FeedbackWidget } from '@/components/feedback-widget';
import { GovernanceGuide } from '@/components/knowledge/GovernanceGuide';
import { RoomHeader } from '@/components/layout/RoomHeader';
import { Badge } from '@/components/ui/badge';
import { useState, useCallback } from 'react';

const SECURITY_PILLARS = [
  {
    icon: Lock,
    title: "Autenticação Segura",
    description: "Login exclusivo via Google OAuth 2.0 (Firebase Authentication). Nenhuma senha é armazenada pelo Espaço Ágil.",
    details: [
      "Tokens JWT assinados pelo Firebase com expiração automática",
      "Sessões gerenciadas pelo Firebase SDK, sem cookies sensíveis",
      "Logout global disponível a qualquer momento"
    ],
    color: "text-emerald-600",
    bg: "bg-emerald-50",
    border: "border-emerald-100"
  },
  {
    icon: Database,
    title: "Dados Isolados por Usuário",
    description: "Cada usuário só acessa seus próprios dados. Regras de segurança (Firestore Security Rules) garantem isolamento total.",
    details: [
      "Kanban, Notas e Configurações são privados por UID",
      "Salas de Poker e Retro usam participantIds para controle de acesso",
      "Token de uso do motor é registrado exclusivamente por userId"
    ],
    color: "text-sky-600",
    bg: "bg-sky-50",
    border: "border-sky-100"
  },
  {
    icon: ShieldCheck,
    title: "Firestore Security Rules",
    description: "Todas as operações de leitura e escrita são validadas no servidor pelo Firebase antes de serem executadas.",
    details: [
      "Regras declarativas impedem acesso não autorizado a qualquer coleção",
      "Validações de schema garantem integridade dos dados",
      "Administradores possuem acesso controlado via role-based check"
    ],
    color: "text-indigo-600",
    bg: "bg-indigo-50",
    border: "border-indigo-100"
  },
  {
    icon: CloudOff,
    title: "Zero Backend Proprietário",
    description: "O Espaço Ágil não mantém servidores próprios. Toda a infraestrutura é gerida pelo Google Cloud via Firebase.",
    details: [
      "Hospedagem via Firebase App Hosting (Google Cloud Run, CDN global com HTTPS automático)",
      "Banco de dados via Cloud Firestore (Google Cloud Platform)",
      "Sem acesso a sistemas internos ou redes corporativas do cliente"
    ],
    color: "text-amber-600",
    bg: "bg-amber-50",
    border: "border-amber-100"
  },
  {
    icon: KeyRound,
    title: "Chaves de API do Usuário",
    description: "As chaves de API do motor (Gemini) são fornecidas e armazenadas pelo próprio usuário, criptografadas no Firestore.",
    details: [
      "Chaves nunca são transmitidas para servidores do Espaço Ágil",
      "Utilizadas apenas em server-side API routes (Next.js) durante a sessão",
      "O usuário pode revogar ou trocar a chave a qualquer momento"
    ],
    color: "text-rose-600",
    bg: "bg-rose-50",
    border: "border-rose-100"
  },
  {
    icon: Eye,
    title: "Transparência Total",
    description: "Nenhum dado é vendido, compartilhado com terceiros ou utilizado para fins de machine learning pela plataforma.",
    details: [
      "Sem rastreadores de terceiros (Google Analytics, Mixpanel, etc.)",
      "Sem coleta de dados comportamentais para revenda",
      "Código auditável — o frontend é open-source"
    ],
    color: "text-violet-600",
    bg: "bg-violet-50",
    border: "border-violet-100"
  }
];

const DATA_CATEGORIES = [
  { category: "Perfil de Usuário", data: "Nome, email, avatar, role, squad", storage: "PostgreSQL", access: "Próprio usuário + Admin" },
  { category: "Notas Rápidas", data: "Conteúdo de texto, cor, status de pin", storage: "PostgreSQL (por usuário)", access: "Somente o usuário" },
  { category: "Salas (Poker/Retro/Health)", data: "Configurações, votos, feedbacks", storage: "PostgreSQL (tabela compartilhada)", access: "Participantes da sala" },
  { category: "Conversas com Assistente", data: "Mensagens, histórico de consultas", storage: "PostgreSQL (filtrado por userId)", access: "Somente o usuário" },
  { category: "Uso de Tokens do Motor", data: "Contagem de tokens consumidos", storage: "PostgreSQL", access: "Usuário + Admin (métricas)" },
  { category: "Tickets de Suporte", data: "Assunto, descrição, respostas", storage: "PostgreSQL", access: "Usuário criador + Admin" },
];

export default function GovernancePage() {
  const router = useRouter();
  const [feedbackSignal, setFeedbackSignal] = useState<number | undefined>();
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const handleOpenFeedback = useCallback(() => setFeedbackSignal(Date.now()), []);

  return (
    <div className="min-h-dvh flex flex-col justify-between w-full bg-[#fafafa] dark:bg-slate-950 text-slate-900 dark:text-slate-100 relative overflow-x-hidden font-body selection:bg-primary/30">
      {/* Help Guide (Standard Sheet) */}
      <GovernanceGuide open={isGuideOpen} onOpenChange={setIsGuideOpen} />

      {/* Subtle background */}
      <div className="fixed inset-0 -z-10 pointer-events-none overflow-hidden" aria-hidden="true">
        <div className="absolute top-[-10%] right-[-10%] w-[60%] h-[60%] bg-emerald-500/5 rounded-full blur-[160px]" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[50%] h-[50%] bg-indigo-50/5 rounded-full blur-[140px]" />
      </div>

      <div className="w-full flex-1 flex flex-col">
        {/* ROOM HEADER */}
        <RoomHeader
          title="Governança & Segurança"
          toolIcon={<ShieldCheck className="h-4 w-4" />}
          toolColorClass="text-emerald-500"
          onOpenFeedback={handleOpenFeedback}
          badge={<Badge className="bg-emerald-500/10 text-emerald-600 border-none font-black uppercase text-[9px] tracking-widest px-2.5 py-0.5 rounded-md">PORTAL CORPORATIVO</Badge>}
          actions={
            <div className="flex items-center gap-2">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setIsGuideOpen(true)}
                className="h-8 px-3 rounded-xl border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 text-[9px] font-bold gap-1.5"
                title="GUIA DE GOVERNANÇA"
              >
                <HelpCircle className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Guia</span>
              </Button>
              <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-800/40 rounded-full">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
                <span className="text-[8px] font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400">Política v2.0</span>
              </div>
            </div>
          }
        />

        <div className="relative z-10 p-4 md:p-6 lg:p-8 flex-1 w-full max-w-7xl mx-auto">
          <main className="w-full space-y-10">

            {/* HERO SECTION */}
            <section className="space-y-3 animate-in fade-in slide-in-from-bottom-4 duration-700">
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-slate-100 dark:bg-slate-850 rounded-full">
                <Building2 className="h-3 w-3 text-slate-500" />
                <span className="text-[8px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Uso Corporativo & Profissional</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-black font-headline uppercase tracking-tight italic text-slate-900 dark:text-white leading-tight max-w-3xl">
                Transparência é a base <br />
                <span className="text-primary not-italic">da confiança.</span>
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-medium leading-relaxed max-w-2xl">
                Este documento descreve como o Espaço Ágil protege seus dados, gerencia acessos e 
                garante a segurança da sua operação. Todas as informações aqui são reais e verificáveis.
              </p>
            </section>

            {/* INFRASTRUCTURE OVERVIEW */}
            <section className="space-y-6">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-slate-900 rounded-lg flex items-center justify-center">
                  <Server className="h-4 w-4 text-primary" />
                </div>
                <h3 className="text-lg font-black font-headline uppercase tracking-tighter italic text-slate-900">Infraestrutura Técnica</h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                  { label: "Frontend", value: "Next.js 16", sub: "React Server Components", icon: Globe, color: "text-slate-900" },
                  { label: "Banco de Dados", value: "Cloud Firestore", sub: "Google Cloud Platform", icon: Database, color: "text-amber-600" },
                  { label: "Autenticação", value: "Firebase Auth", sub: "Google OAuth 2.0", icon: Fingerprint, color: "text-emerald-600" },
                ].map((item, i) => (
                  <Card key={i} className="border-2 border-slate-100 rounded-2xl p-5 hover:shadow-lg transition-all group">
                    <div className="flex items-start gap-4">
                      <div className="w-10 h-10 bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                        <item.icon className={cn("h-5 w-5", item.color)} />
                      </div>
                      <div>
                        <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-0.5">{item.label}</p>
                        <p className="text-sm font-black text-slate-900">{item.value}</p>
                        <p className="text-[10px] text-slate-500 font-medium">{item.sub}</p>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </section>

            {/* SECURITY PILLARS */}
            <section className="space-y-6">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-slate-900 rounded-lg flex items-center justify-center">
                  <Lock className="h-4 w-4 text-primary" />
                </div>
                <h3 className="text-lg font-black font-headline uppercase tracking-tighter italic text-slate-900">Pilares de Segurança</h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {SECURITY_PILLARS.map((pillar, i) => (
                  <Card key={i} className={cn("border-2 rounded-2xl overflow-hidden hover:shadow-lg transition-all group", pillar.border)}>
                    <CardContent className="p-5 space-y-3">
                      <div className="flex items-start gap-3">
                        <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0", pillar.bg)}>
                          <pillar.icon className={cn("h-5 w-5", pillar.color)} />
                        </div>
                        <div>
                          <h4 className="text-sm font-black uppercase tracking-tight text-slate-900">{pillar.title}</h4>
                          <p className="text-[11px] text-slate-500 font-medium leading-relaxed mt-1">{pillar.description}</p>
                        </div>
                      </div>
                      <div className="space-y-1.5 pl-1">
                        {pillar.details.map((detail, j) => (
                          <div key={j} className="flex items-start gap-2">
                            <CheckCircle2 className={cn("h-3.5 w-3.5 shrink-0 mt-0.5", pillar.color)} />
                            <span className="text-[11px] text-slate-600 font-medium leading-snug">{detail}</span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </section>

            {/* DATA INVENTORY TABLE */}
            <section className="space-y-6">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-slate-900 rounded-lg flex items-center justify-center">
                  <FileCheck className="h-4 w-4 text-primary" />
                </div>
                <h3 className="text-lg font-black font-headline uppercase tracking-tighter italic text-slate-900">Inventário de Dados</h3>
              </div>

              <Card className="border-2 border-slate-100 rounded-2xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-100">
                        <th className="px-5 py-3 text-[9px] font-black uppercase tracking-widest text-slate-500">Categoria</th>
                        <th className="px-5 py-3 text-[9px] font-black uppercase tracking-widest text-slate-500">Dados Coletados</th>
                        <th className="px-5 py-3 text-[9px] font-black uppercase tracking-widest text-slate-500">Armazenamento</th>
                        <th className="px-5 py-3 text-[9px] font-black uppercase tracking-widest text-slate-500">Quem Acessa</th>
                      </tr>
                    </thead>
                    <tbody>
                      {DATA_CATEGORIES.map((row, i) => (
                        <tr key={i} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                          <td className="px-5 py-3 text-xs font-bold text-slate-900">{row.category}</td>
                          <td className="px-5 py-3 text-[11px] text-slate-600 font-medium">{row.data}</td>
                          <td className="px-5 py-3 text-[11px] text-slate-600 font-medium">{row.storage}</td>
                          <td className="px-5 py-3 text-[11px] text-slate-600 font-medium">{row.access}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            </section>

            {/* COMPLIANCE & DISCLAIMERS */}
            <section className="space-y-6">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-slate-900 rounded-lg flex items-center justify-center">
                  <Scale className="h-4 w-4 text-primary" />
                </div>
                <h3 className="text-lg font-black font-headline uppercase tracking-tighter italic text-slate-900">Conformidade & Avisos Legais</h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card className="border-2 border-slate-100 rounded-2xl p-5 space-y-3">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-500" />
                    <h4 className="text-xs font-black uppercase tracking-tight text-slate-900">Limitações de Responsabilidade</h4>
                  </div>
                  <div className="space-y-2 text-[11px] text-slate-600 font-medium leading-relaxed">
                    <p>O Espaço Ágil é uma ferramenta de apoio a cerimônias ágeis e produtividade. <strong>Não substitui</strong> ferramentas de gestão empresarial (Jira, Azure DevOps) nem possui SLA garantido.</p>
                    <p>A plataforma não se responsabiliza por perda de dados em caso de falhas no Firebase/Google Cloud, embora tais eventos sejam extremamente raros.</p>
                  </div>
                </Card>

                <Card className="border-2 border-slate-100 rounded-2xl p-5 space-y-3">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-indigo-500" />
                    <h4 className="text-xs font-black uppercase tracking-tight text-slate-900">Uso Corporativo</h4>
                  </div>
                  <div className="space-y-2 text-[11px] text-slate-600 font-medium leading-relaxed">
                    <p>O Espaço Ágil pode ser utilizado em ambientes corporativos desde que os participantes estejam cientes de que os dados trafegam por infraestrutura Google Cloud (Firebase).</p>
                    <p>Para empresas com requisitos LGPD avançados, recomendamos revisão com o time de compliance antes da adoção em larga escala.</p>
                  </div>
                </Card>

                <Card className="border-2 border-slate-100 rounded-2xl p-5 space-y-3">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-cyan-500" />
                    <h4 className="text-xs font-black uppercase tracking-tight text-slate-900">Motor de Processamento Avançado</h4>
                  </div>
                  <div className="space-y-2 text-[11px] text-slate-600 font-medium leading-relaxed">
                    <p>O módulo de Base de Conhecimento utiliza a API do Google Gemini para chat e busca semântica. <strong>A chave de API é fornecida pelo próprio usuário</strong> e não é compartilhada com a plataforma.</p>
                    <p>Nenhuma conversa com o assistente virtual é utilizada para treinar modelos de terceiros.</p>
                  </div>
                </Card>

                <Card className="border-2 border-slate-100 rounded-2xl p-5 space-y-3">
                  <div className="flex items-center gap-2">
                    <Globe className="h-4 w-4 text-emerald-500" />
                    <h4 className="text-xs font-black uppercase tracking-tight text-slate-900">LGPD & Privacidade</h4>
                  </div>
                  <div className="space-y-2 text-[11px] text-slate-600 font-medium leading-relaxed">
                    <p>O Espaço Ágil coleta apenas os dados estritamente necessários para o funcionamento da aplicação. Não há coleta de dados sensíveis (biometria, localização, etc.).</p>
                    <p>O usuário pode solicitar a exclusão completa de seus dados a qualquer momento via canal de suporte.</p>
                  </div>
                </Card>
              </div>
            </section>

            {/* CONTACT / CTA */}
            <section className="p-8 bg-gradient-to-br from-slate-900 to-slate-800 rounded-[2rem] text-white shadow-2xl">
              <div className="max-w-2xl">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
                    <Rocket className="h-5 w-5 text-white" />
                  </div>
                  <p className="text-[11px] font-black uppercase tracking-widest text-white/70">Precisa de Mais Informações?</p>
                </div>
                <h3 className="text-2xl font-black font-headline uppercase tracking-tighter italic leading-tight mb-3">
                  Dúvidas sobre segurança? <br />
                  <span className="text-primary not-italic">Estamos aqui para ajudar.</span>
                </h3>
                <p className="text-xs text-white/60 leading-relaxed mb-6 font-medium max-w-lg">
                  Se sua empresa possui requisitos específicos de compliance, auditoria ou segurança, entre em contato conosco pelo canal de suporte.
                </p>
                <div className="flex flex-wrap gap-3">
                  <Button 
                    onClick={() => router.push('/support')} 
                    className="h-11 px-8 bg-white text-slate-900 rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-primary hover:text-white transition-all gap-2"
                  >
                    Abrir Suporte <ExternalLink className="h-3.5 w-3.5" />
                  </Button>
                  <Button 
                    onClick={() => router.push('/manual')} 
                    className="h-11 px-8 bg-white/10 border border-white/20 text-white rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-white/20 transition-all gap-2"
                  >
                    Manual do Usuário
                  </Button>
                </div>
              </div>
            </section>
          </main>
        </div>
      </div>

      <Footer className="mt-8 shrink-0" onOpenFeedback={handleOpenFeedback} />
      <FeedbackWidget 
        toolName="Espaço Ágil - Governança" 
        externalTriggerSignal={feedbackSignal} 
        triggerVariant="none" 
      />
    </div>
  );
}

"use client";

import React from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Footer } from '@/components/layout/Footer';
import {
  Lock,
  Server,
  FileCheck,
  Users,
  Globe,
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
    title: "Autenticação",
    description: "Login por email e senha, autenticado direto pelo backend próprio (Spring Boot) — sem depender de um provedor externo. Login com Google Workspace está em desenvolvimento, ainda não disponível.",
    details: [
      "Token JWT emitido e validado pelo backend, com expiração",
      "Recuperação de senha própria (/api/auth/forgot-password)",
      "Nenhuma senha em texto puro: hash + verificação no servidor"
    ],
    color: "text-emerald-600",
    bg: "bg-emerald-50",
    border: "border-emerald-100"
  },
  {
    icon: Database,
    title: "Autorização por Recurso",
    description: "Um filtro único exige token válido em toda chamada a /api/**, com exceções explícitas e documentadas (login, changelog público, Vault por design).",
    details: [
      "Endpoints administrativos exigem role ADMIN no próprio token",
      "Dados pessoais (ex.: sessões de foco) exigem que o token bata com o dono do recurso",
      "Squads têm um módulo próprio de liderança (SquadLeadership) para checagem de acesso por squad"
    ],
    color: "text-sky-600",
    bg: "bg-sky-50",
    border: "border-sky-100"
  },
  {
    icon: ShieldCheck,
    title: "Persistência em PostgreSQL",
    description: "Todo dado de negócio fica no backend próprio (Spring Boot + PostgreSQL) — não há mais dependência de um provedor de dados externo.",
    details: [
      "Campos sensíveis (ex.: token de integração com Jira) cifrados em repouso com AES-GCM",
      "Cofre de Segredos usa criptografia zero-knowledge no navegador: o backend nunca vê o texto puro",
      "Sem migrations manuais: o schema é derivado diretamente das entidades"
    ],
    color: "text-indigo-600",
    bg: "bg-indigo-50",
    border: "border-indigo-100"
  },
  {
    icon: Server,
    title: "Tempo Real Autenticado",
    description: "As conexões WebSocket (Poker, Retro, Brainstorming, Radar de Saúde, Showcase) também exigem token válido no handshake, não só nas chamadas REST.",
    details: [
      "Handshake validado por um interceptor dedicado antes de abrir a conexão",
      "O payload do WebSocket é só um sinal de atualização — o dado em si sempre vem de uma chamada REST autenticada",
      "Mesma identidade (uid, role) usada nas chamadas REST e no tempo real"
    ],
    color: "text-amber-600",
    bg: "bg-amber-50",
    border: "border-amber-100"
  },
  {
    icon: KeyRound,
    title: "CORS Restrito",
    description: "Ao contrário de liberar qualquer origem, o backend só aceita chamadas de uma lista explícita de domínios configurados.",
    details: [
      "Lista de origens permitidas vem de configuração (ALLOWED_ORIGINS), não de um curinga",
      "Aplicado antes do processamento normal da requisição, cobrindo inclusive respostas 401/403",
      "Reduz a superfície de ataque de sites de terceiros tentando usar a sessão de um usuário logado"
    ],
    color: "text-rose-600",
    bg: "bg-rose-50",
    border: "border-rose-100"
  },
  {
    icon: Sparkles,
    title: "Transparência de Código",
    description: "Sem coleta de dados comportamentais escondida no código.",
    details: [
      "Nenhuma dependência de analytics ou rastreamento de terceiros no código-fonte (conferível no package.json)",
      "Conversas com o assistente de IA não treinam modelos de terceiros — ficam isoladas por usuário",
      "Este documento é mantido junto do código; uma divergência encontrada é bug, não intenção"
    ],
    color: "text-violet-600",
    bg: "bg-violet-50",
    border: "border-violet-100"
  }
];

const KNOWN_LIMITATIONS = [
  {
    title: "Validação de certificado do Jira",
    detail: "O backend tenta validar o certificado TLS normalmente primeiro; só aceita qualquer certificado como fallback quando detecta o erro específico de handshake típico de um Jira corporativo com CA própria. Ainda assim, esse fallback existe e vale acompanhar."
  },
  {
    title: "Escopo desta revisão",
    detail: "Confirmamos autenticação, autorização de admin, dados pessoais, WebSocket e CORS. Não auditamos individualmente se todos os domínios com dado por squad (Jira, Daily Flow, Sprint Planner, Plano de Ação, Base de Conhecimento) aplicam o módulo de liderança de squad de forma consistente — o módulo existe e é usado em pelo menos convites e gestão de squad."
  }
];

const DATA_CATEGORIES = [
  { category: "Perfil de Usuário", data: "Nome, email, avatar, role, squad", storage: "PostgreSQL", access: "Próprio usuário + Admin" },
  { category: "Notas Rápidas", data: "Conteúdo de texto, cor, status de pin", storage: "PostgreSQL (por usuário)", access: "Somente o usuário" },
  { category: "Salas (Poker/Retro/Health)", data: "Configurações, votos, feedbacks", storage: "PostgreSQL (tabela compartilhada)", access: "Participantes da sala" },
  { category: "Conversas com Assistente", data: "Mensagens, histórico de consultas", storage: "PostgreSQL (filtrado por userId)", access: "Somente o usuário" },
  { category: "Uso de Tokens do Motor", data: "Contagem de tokens consumidos", storage: "PostgreSQL", access: "Usuário + Admin (métricas)" },
  { category: "Tickets de Suporte", data: "Assunto, descrição, respostas", storage: "PostgreSQL", access: "Usuário criador + Admin" },
  { category: "Cofre de Segredos (Vault)", data: "Segredo cifrado + IV — backend nunca vê o texto puro", storage: "PostgreSQL, AES-GCM cifrado no navegador", access: "Quem tiver o link/ID (zero-knowledge, por design)" },
  { category: "Integração Jira/TDN do usuário", data: "Token e URL da integração pessoal", storage: "PostgreSQL, campo cifrado (AES-GCM)", access: "Somente o usuário dono" },
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
                <span className="text-[8px] font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400">Política v3.0</span>
              </div>
            </div>
          }
        />

        <div className="relative z-10 p-4 md:p-6 lg:p-8 flex-1 w-full max-w-7xl mx-auto">
          <main className="w-full space-y-10">

            {/* HERO SECTION */}
            <section className="space-y-3 animate-in fade-in slide-in-from-bottom-4 duration-700">
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-slate-100 dark:bg-slate-800 rounded-full">
                <Building2 className="h-3 w-3 text-slate-500" />
                <span className="text-[8px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Uso Corporativo & Profissional</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-black font-headline uppercase tracking-tight italic text-slate-900 dark:text-white leading-tight max-w-3xl">
                Transparência é a base <br />
                <span className="text-primary not-italic">da confiança.</span>
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-medium leading-relaxed max-w-2xl">
                Este documento descreve como o Espaço Ágil protege seus dados, gerencia acessos e
                garante a segurança da sua operação — incluindo o que ainda está em progresso. Preferimos
                listar uma limitação conhecida a prometer algo que o código não sustenta.
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

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  { label: "Frontend", value: "Next.js", sub: "React Server Components", icon: Globe, color: "text-slate-900" },
                  { label: "Backend", value: "Spring Boot 3", sub: "Java · REST + WebSocket", icon: Server, color: "text-indigo-600" },
                  { label: "Banco de Dados", value: "PostgreSQL", sub: "Spring Data JPA", icon: Database, color: "text-amber-600" },
                  { label: "Autenticação", value: "JWT Próprio", sub: "Emitido pelo backend", icon: Fingerprint, color: "text-emerald-600" },
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

            {/* KNOWN LIMITATIONS */}
            <section className="space-y-6">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-amber-500 rounded-lg flex items-center justify-center">
                  <AlertTriangle className="h-4 w-4 text-white" />
                </div>
                <h3 className="text-lg font-black font-headline uppercase tracking-tighter italic text-slate-900">Limitações Conhecidas</h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {KNOWN_LIMITATIONS.map((item, i) => (
                  <Card key={i} className="border-2 border-amber-100 bg-amber-50/40 rounded-2xl p-5 space-y-2">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                      <h4 className="text-xs font-black uppercase tracking-tight text-slate-900">{item.title}</h4>
                    </div>
                    <p className="text-[11px] text-slate-600 font-medium leading-relaxed">{item.detail}</p>
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
                    <p>A plataforma não se responsabiliza por perda de dados em caso de falha na infraestrutura de banco de dados ou backend.</p>
                  </div>
                </Card>

                <Card className="border-2 border-slate-100 rounded-2xl p-5 space-y-3">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-indigo-500" />
                    <h4 className="text-xs font-black uppercase tracking-tight text-slate-900">Uso Corporativo</h4>
                  </div>
                  <div className="space-y-2 text-[11px] text-slate-600 font-medium leading-relaxed">
                    <p>Login e dados de negócio são geridos inteiramente pelo backend e banco PostgreSQL próprios do Espaço Ágil — consulte o time de plataforma para detalhes de hospedagem.</p>
                    <p>Para empresas com requisitos LGPD avançados, recomendamos revisão com o time de compliance antes da adoção em larga escala.</p>
                  </div>
                </Card>

                <Card className="border-2 border-slate-100 rounded-2xl p-5 space-y-3">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-cyan-500" />
                    <h4 className="text-xs font-black uppercase tracking-tight text-slate-900">Assistente de IA da Base de Conhecimento</h4>
                  </div>
                  <div className="space-y-2 text-[11px] text-slate-600 font-medium leading-relaxed">
                    <p>O módulo de Base de Conhecimento utiliza modelos de IA para chat e busca semântica. Nenhuma conversa com o assistente virtual é utilizada para treinar modelos de terceiros, e o histórico fica isolado por usuário no banco do Espaço Ágil.</p>
                  </div>
                </Card>

                <Card className="border-2 border-slate-100 rounded-2xl p-5 space-y-3">
                  <div className="flex items-center gap-2">
                    <Globe className="h-4 w-4 text-emerald-500" />
                    <h4 className="text-xs font-black uppercase tracking-tight text-slate-900">LGPD & Privacidade</h4>
                  </div>
                  <div className="space-y-2 text-[11px] text-slate-600 font-medium leading-relaxed">
                    <p>Tecnicamente, o Espaço Ágil não coleta dados sensíveis (biometria, localização, etc.). O enquadramento formal em LGPD — base legal, DPO, retenção — é uma decisão do time jurídico/compliance da empresa, não algo que este documento certifica sozinho.</p>
                    <p>O usuário pode solicitar a exclusão de seus dados a qualquer momento via canal de suporte.</p>
                  </div>
                </Card>
              </div>
            </section>

            {/* CONTACT / CTA */}
            <section className="p-8 bg-gradient-to-br from-slate-900 to-slate-800 rounded-[2rem] text-white shadow-2xl">
              <div className="max-w-2xl">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
                    <ShieldCheck className="h-5 w-5 text-white" />
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

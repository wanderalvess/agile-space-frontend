"use client";

import React from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { PageHeader, PageShell } from '@/components/page';
import { StatusChip } from '@/components/room-kit';
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
import { GovernanceGuide } from '@/components/knowledge/GovernanceGuide';
import { useState } from 'react';

const SECURITY_PILLARS = [
  {
    icon: Lock,
    title: "Autenticação",
    description: "Login por email e senha, autenticado direto pelo backend próprio (Spring Boot) — sem depender de um provedor externo. O cadastro é aberto apenas a e-mails @totvs.com.br e @ext.totvs.com.br e não exige confirmação por e-mail. Login com Google ou SSO corporativo ainda não existe (está planejado).",
    details: [
      "Token JWT de 24 horas emitido e validado pelo backend. Não há logout nem refresh no servidor: desativar a conta é o que bloqueia o acesso (em até 30 segundos)",
      "Recuperação de senha própria (/api/auth/forgot-password)",
      "Nenhuma senha em texto puro: hash + verificação no servidor"
    ],
    color: "text-emerald-600 dark:text-emerald-400",
    bg: "bg-emerald-50 dark:bg-emerald-950/40",
    border: "border-emerald-200/60 dark:border-emerald-800/40"
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
    color: "text-sky-600 dark:text-sky-400",
    bg: "bg-sky-50 dark:bg-sky-950/40",
    border: "border-sky-200/60 dark:border-sky-800/40"
  },
  {
    icon: ShieldCheck,
    title: "Persistência em PostgreSQL",
    description: "Todo dado de negócio fica no backend próprio (Spring Boot + PostgreSQL) — não há mais dependência de um provedor de dados externo.",
    details: [
      "Campos sensíveis (ex.: token de integração com Jira) cifrados em repouso com AES-GCM",
      "Cofre de Segredos usa criptografia zero-knowledge no navegador: o backend nunca vê o texto puro",
      "Mudanças de schema por migrations versionadas (Flyway); o servidor valida o schema ao subir"
    ],
    color: "text-indigo-600 dark:text-indigo-400",
    bg: "bg-indigo-50 dark:bg-indigo-950/40",
    border: "border-indigo-200/60 dark:border-indigo-800/40"
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
    color: "text-amber-600 dark:text-amber-400",
    bg: "bg-amber-50 dark:bg-amber-950/40",
    border: "border-amber-200/60 dark:border-amber-800/40"
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
    color: "text-rose-600 dark:text-rose-400",
    bg: "bg-rose-50 dark:bg-rose-950/40",
    border: "border-rose-200/60 dark:border-rose-800/40"
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
    color: "text-violet-600 dark:text-violet-400",
    bg: "bg-violet-50 dark:bg-violet-950/40",
    border: "border-violet-200/60 dark:border-violet-800/40"
  }
];

const KNOWN_LIMITATIONS = [
  {
    title: "Token do Jira e do TDN",
    detail: "No servidor o token fica cifrado, mas é devolvido em texto claro ao dono e a qualquer administrador. No navegador ele fica em texto claro (localStorage) e não é apagado ao sair. Quem executar script na página consegue lê-lo."
  },
  {
    title: "Acesso por cargo",
    detail: "Os painéis por cargo (ex.: Product Owner) escondem abas na interface, mas o servidor libera os mesmos dados a qualquer membro da squad. Só o cadastro de equipes (Agile Master, People Lead e admin) é imposto no servidor."
  },
  {
    title: "Validação de certificado do Jira",
    detail: "O backend tenta validar o certificado TLS normalmente primeiro; só aceita qualquer certificado como fallback quando detecta o erro específico de handshake típico de um Jira corporativo com CA própria. Ainda assim, esse fallback existe e vale acompanhar."
  },
  {
    title: "Escopo desta revisão",
    detail: "Confirmamos autenticação, autorização de admin, dados pessoais, WebSocket e CORS. O acesso por squad não é aplicado de forma igual em todos os módulos (por exemplo, o acesso por link na Review, no Brainstorming e no Radar de Saúde). A lista atualizada, módulo a módulo, está nos documentos de fluxos do repositório (docs/fluxos)."
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
  { category: "Integração Jira/TDN do usuário", data: "Token e URL da integração pessoal", storage: "PostgreSQL, campo cifrado (AES-GCM); cópia em texto claro no navegador do dono", access: "Usuário dono e administradores" },
];

export default function GovernancePage() {
  const router = useRouter();
  const [isGuideOpen, setIsGuideOpen] = useState(false);

  return (
    <PageShell documentTitle="Segurança e dados">
      <GovernanceGuide open={isGuideOpen} onOpenChange={setIsGuideOpen} />

      <PageHeader
        title="Segurança e dados"
        module="governance"
        subtitle="Como o portal protege os dados, controla acessos e o que ainda está em progresso."
        breadcrumb={[{ label: 'Home', href: '/' }, { label: 'Segurança e dados' }]}
        badges={<StatusChip tone="success">Revisada em 09/10/2026</StatusChip>}
        actions={
          <Button variant="outline" size="sm" onClick={() => setIsGuideOpen(true)} className="h-9 gap-1.5 rounded-xl text-xs font-semibold" title="Guia de segurança e dados">
            <HelpCircle className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
            Guia
          </Button>
        }
      />

      <div className="space-y-10">
      {/* HERO SECTION */}
      <section className="space-y-3 animate-in fade-in slide-in-from-bottom-4 duration-700">
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-muted rounded-full">
          <Building2 className="h-3 w-3 text-muted-foreground" />
          <span className="text-xs font-black uppercase tracking-widest text-muted-foreground">Uso Corporativo & Profissional</span>
        </div>
        <h2 className="text-2xl sm:text-3xl font-black font-headline uppercase tracking-tight italic text-foreground leading-tight max-w-3xl">
          Transparência é a base <br />
          <span className="text-primary not-italic">da confiança.</span>
        </h2>
        <p className="text-xs sm:text-sm text-muted-foreground font-medium leading-relaxed max-w-3xl">
          Este documento descreve como o Portal Tech V&D protege seus dados, gerencia acessos e
          garante a segurança da sua operação — incluindo o que ainda está em progresso. Preferimos
          listar uma limitação conhecida a prometer algo que o código não sustenta.
        </p>
      </section>

      {/* INFRASTRUCTURE OVERVIEW */}
      <section className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-muted border border-border rounded-xl flex items-center justify-center">
            <Server className="h-4 w-4 text-primary" />
          </div>
          <h3 className="text-lg font-black font-headline uppercase tracking-tighter italic text-foreground">Infraestrutura Técnica</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: "Frontend", value: "Next.js", sub: "React Server Components", icon: Globe, color: "text-foreground" },
            { label: "Backend", value: "Spring Boot 3", sub: "Java · REST + WebSocket", icon: Server, color: "text-indigo-600 dark:text-indigo-400" },
            { label: "Banco de Dados", value: "PostgreSQL", sub: "Spring Data JPA", icon: Database, color: "text-amber-600 dark:text-amber-400" },
            { label: "Autenticação", value: "JWT Próprio", sub: "Emitido pelo backend", icon: Fingerprint, color: "text-emerald-600 dark:text-emerald-400" },
          ].map((item, i) => (
            <Card key={i} className="border border-border/80 bg-card/80 backdrop-blur-xl rounded-2xl p-5 hover:shadow-lg transition-all group">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 bg-muted border border-border/60 rounded-xl flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                  <item.icon className={cn("h-5 w-5", item.color)} />
                </div>
                <div>
                  <p className="text-xs font-black uppercase tracking-widest text-muted-foreground mb-0.5">{item.label}</p>
                  <p className="text-sm font-black text-foreground">{item.value}</p>
                  <p className="text-xs text-muted-foreground font-medium">{item.sub}</p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </section>

      {/* SECURITY PILLARS */}
      <section className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-muted border border-border rounded-xl flex items-center justify-center">
            <Lock className="h-4 w-4 text-primary" />
          </div>
          <h3 className="text-lg font-black font-headline uppercase tracking-tighter italic text-foreground">Pilares de Segurança</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {SECURITY_PILLARS.map((pillar, i) => (
            <Card key={i} className={cn("border rounded-2xl overflow-hidden hover:shadow-lg transition-all group bg-card/80 backdrop-blur-xl", pillar.border)}>
              <CardContent className="p-5 space-y-3">
                <div className="flex items-start gap-3">
                  <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0", pillar.bg)}>
                    <pillar.icon className={cn("h-5 w-5", pillar.color)} />
                  </div>
                  <div>
                    <h4 className="text-sm font-black uppercase tracking-tight text-foreground">{pillar.title}</h4>
                    <p className="text-xs text-muted-foreground font-medium leading-relaxed mt-1">{pillar.description}</p>
                  </div>
                </div>
                <div className="space-y-1.5 pl-1">
                  {pillar.details.map((detail, j) => (
                    <div key={j} className="flex items-start gap-2">
                      <CheckCircle2 className={cn("h-3.5 w-3.5 shrink-0 mt-0.5", pillar.color)} />
                      <span className="text-xs text-muted-foreground font-medium leading-snug">{detail}</span>
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
          <div className="w-8 h-8 bg-amber-500/10 dark:bg-amber-500/20 border border-amber-500/30 rounded-xl flex items-center justify-center">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
          </div>
          <h3 className="text-lg font-black font-headline uppercase tracking-tighter italic text-foreground">Limitações Conhecidas</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {KNOWN_LIMITATIONS.map((item, i) => (
            <Card key={i} className="border border-amber-200/60 dark:border-amber-800/40 bg-amber-50/40 dark:bg-amber-950/20 rounded-2xl p-5 space-y-2">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
                <h4 className="text-xs font-black uppercase tracking-tight text-foreground">{item.title}</h4>
              </div>
              <p className="text-xs text-muted-foreground font-medium leading-relaxed">{item.detail}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* DATA INVENTORY TABLE */}
      <section className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-muted border border-border rounded-xl flex items-center justify-center">
            <FileCheck className="h-4 w-4 text-primary" />
          </div>
          <h3 className="text-lg font-black font-headline uppercase tracking-tighter italic text-foreground">Inventário de Dados</h3>
        </div>

        <Card className="border border-border/80 bg-card/80 backdrop-blur-xl rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-background/80 border-b border-border/80">
                  <th className="px-5 py-3 text-xs font-black uppercase tracking-widest text-muted-foreground">Categoria</th>
                  <th className="px-5 py-3 text-xs font-black uppercase tracking-widest text-muted-foreground">Dados Coletados</th>
                  <th className="px-5 py-3 text-xs font-black uppercase tracking-widest text-muted-foreground">Armazenamento</th>
                  <th className="px-5 py-3 text-xs font-black uppercase tracking-widest text-muted-foreground">Quem Acessa</th>
                </tr>
              </thead>
              <tbody>
                {DATA_CATEGORIES.map((row, i) => (
                  <tr key={i} className="border-b border-border hover:bg-background/50 transition-colors">
                    <td className="px-5 py-3 text-xs font-bold text-foreground">{row.category}</td>
                    <td className="px-5 py-3 text-xs text-muted-foreground font-medium">{row.data}</td>
                    <td className="px-5 py-3 text-xs text-muted-foreground font-medium">{row.storage}</td>
                    <td className="px-5 py-3 text-xs text-muted-foreground font-medium">{row.access}</td>
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
          <div className="w-8 h-8 bg-muted border border-border rounded-xl flex items-center justify-center">
            <Scale className="h-4 w-4 text-primary" />
          </div>
          <h3 className="text-lg font-black font-headline uppercase tracking-tighter italic text-foreground">Conformidade & Avisos Legais</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="border border-border/80 bg-card/80 backdrop-blur-xl rounded-2xl p-5 space-y-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              <h4 className="text-xs font-black uppercase tracking-tight text-foreground">Limitações de Responsabilidade</h4>
            </div>
            <div className="space-y-2 text-xs text-muted-foreground font-medium leading-relaxed">
              <p>O Portal Tech V&D é uma ferramenta de apoio a cerimônias ágeis e produtividade. <strong>Não substitui</strong> ferramentas de gestão empresarial (Jira, Azure DevOps) nem possui SLA garantido.</p>
              <p>A plataforma não se responsabiliza por perda de dados em caso de falha na infraestrutura de banco de dados ou backend.</p>
            </div>
          </Card>

          <Card className="border border-border/80 bg-card/80 backdrop-blur-xl rounded-2xl p-5 space-y-3">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-indigo-500" />
              <h4 className="text-xs font-black uppercase tracking-tight text-foreground">Uso Corporativo</h4>
            </div>
            <div className="space-y-2 text-xs text-muted-foreground font-medium leading-relaxed">
              <p>Login e dados de negócio são geridos inteiramente pelo backend e banco PostgreSQL próprios do Portal Tech V&D — consulte o time de plataforma para detalhes de hospedagem.</p>
              <p>Para empresas com requisitos LGPD avançados, recomendamos revisão com o time de compliance antes da adoção em larga escala.</p>
            </div>
          </Card>

          <Card className="border border-border/80 bg-card/80 backdrop-blur-xl rounded-2xl p-5 space-y-3">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-cyan-500" />
              <h4 className="text-xs font-black uppercase tracking-tight text-foreground">Assistente de IA da Base de Conhecimento</h4>
            </div>
            <div className="space-y-2 text-xs text-muted-foreground font-medium leading-relaxed">
              <p>O módulo de Base de Conhecimento utiliza modelos de IA para chat e busca semântica. Nenhuma conversa com o assistente virtual é utilizada para treinar modelos de terceiros, e o histórico fica isolado por usuário no banco do Portal Tech V&D.</p>
            </div>
          </Card>

          <Card className="border border-border/80 bg-card/80 backdrop-blur-xl rounded-2xl p-5 space-y-3">
            <div className="flex items-center gap-2">
              <Globe className="h-4 w-4 text-emerald-500" />
              <h4 className="text-xs font-black uppercase tracking-tight text-foreground">LGPD & Privacidade</h4>
            </div>
            <div className="space-y-2 text-xs text-muted-foreground font-medium leading-relaxed">
              <p>Tecnicamente, o Portal Tech V&D não coleta dados sensíveis (biometria, localização, etc.). O enquadramento formal em LGPD — base legal, DPO, retenção — é uma decisão do time jurídico/compliance da empresa, não algo que este documento certifica sozinho.</p>
              <p>O usuário pode solicitar a exclusão de seus dados a qualquer momento via canal de suporte.</p>
            </div>
          </Card>
        </div>
      </section>

      {/* CONTACT / CTA */}
      <section className="p-8 md:p-12 bg-slate-900 rounded-[2.5rem] text-white shadow-2xl border border-slate-800">
        <div className="max-w-2xl">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
              <ShieldCheck className="h-5 w-5 text-white" />
            </div>
            <p className="text-xs font-black uppercase tracking-widest text-white/70">Precisa de Mais Informações?</p>
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
              className="h-11 px-8 bg-card dark:bg-primary text-foreground rounded-xl font-black uppercase text-xs tracking-widest hover:bg-muted dark:hover:bg-primary/90 transition-all gap-2 shadow-md"
            >
              Abrir Suporte <ExternalLink className="h-3.5 w-3.5" />
            </Button>
            <Button
              onClick={() => router.push('/manual')}
              className="h-11 px-8 bg-white/10 border border-white/20 text-white rounded-xl font-black uppercase text-xs tracking-widest hover:bg-white/20 transition-all gap-2"
            >
              Manual do Usuário
            </Button>
          </div>
        </div>
      </section>
      </div>
    </PageShell>
  );
}

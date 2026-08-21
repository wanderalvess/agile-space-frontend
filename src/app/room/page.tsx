'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { listTemplates, type PokerTemplate } from '@/lib/poker-templates';
import { DECKS, TSHIRT_UNIT_LABELS, type TshirtUnit } from '@/lib/types';
import { DEFAULT_ROOM_SETTINGS } from '@/lib/poker-utils';

// Metadados dos baralhos para os cartões visuais do modal de configuração.
const DECK_OPTIONS = [
  { key: 'fibonacci', name: 'Fibonacci', tagline: 'Story Points', sample: ['1', '2', '3', '5', '8', '13'], desc: 'Complexidade relativa. Ideal para User Stories — a escala não-linear força a discutir o risco.' },
  { key: 'hours', name: 'Horas Reais', tagline: 'Esforço em horas', sample: ['1h', '2h', '4h', '8h'], desc: 'Estimativa em horas por papel (Dev/QA). Ideal para sub-tarefas e planejamento fino de capacidade.' },
  { key: 'tshirt', name: 'Camisetas', tagline: 'Tamanhos', sample: ['PP', 'P', 'M', 'G', 'GG'], desc: 'Tamanhos relativos, rápidos. Ideal para triagem inicial e itens ainda pouco detalhados.' },
] as const;

// Toggles exibidos na criação, na mesma ordem em que fazem sentido explicar:
// primeiro o que só acrescenta informação, depois o que dá ação ao
// facilitador, depois o que muda o ritual do time e por fim o que age sozinho.
const SETUP_GROUPS = [
  {
    label: 'Dados e visão',
    items: [
      { key: 'perTopicTime', title: 'Tempo por tópico', desc: 'Quanto durou cada item' },
      { key: 'showDistribution', title: 'Distribuição dos votos', desc: 'Histograma ao revelar' },
      { key: 'showVelocity', title: 'Velocity do time', desc: 'Histórico no dashboard final' },
      { key: 'decisionNotes', title: 'Nota de decisão', desc: 'Por que estimamos assim' },
      { key: 'refinementNotes', title: 'Notas de refinamento', desc: 'Solução técnica e cenários de QA' },
    ],
  },
  {
    label: 'Opções do facilitador',
    items: [
      { key: 'parkTask', title: 'Adiar tarefa', desc: 'Volta o item pro fim da fila' },
      { key: 'referenceStory', title: 'História de referência', desc: 'Régua visível na votação' },
      { key: 'roundNudge', title: 'Aviso de rodadas', desc: 'Sugere quebrar ou adiar' },
      { key: 'suggestRevote', title: 'Sugerir revotação', desc: 'Em divergência crítica' },
    ],
  },
  {
    label: 'Ritual de votação',
    items: [
      { key: 'confidenceVote', title: 'Voto de confiança', desc: 'Baixa / média / alta' },
      { key: 'outlierPrompt', title: 'Justificar extremos', desc: 'Maior e menor explicam' },
    ],
  },
  {
    label: 'Automação',
    items: [
      { key: 'allowManagementToVote', title: 'Gestão pode votar', desc: 'Inclui papéis de gestão' },
      { key: 'autoReveal', title: 'Auto-revelar', desc: 'Quando todos votarem' },
      { key: 'autoConsensus', title: 'Auto-consenso', desc: 'Salva e avança no consenso' },
    ],
  },
] as const;

const MODE_OPTIONS = [
  { key: 'sync', emoji: '🚀', name: 'Síncrono', tagline: 'Ao vivo', desc: 'Todos votam juntos, em tempo real, com revelação simultânea. Ideal para o time reunido.' },
  { key: 'async', emoji: '🕰️', name: 'Assíncrono', tagline: 'No seu tempo', desc: 'Cada um vota por tarefa quando puder. Ideal para times distribuídos ou fusos diferentes.' },
] as const;
import { 
  WalletCards, 
  Zap, 
  Target, 
  Users, 
  Lock,
  ArrowRight as ArrowRightIcon,
  MessageSquare,
  Trophy,
  ListPlus,
  Shield
} from 'lucide-react';
import { useFirebase } from '@/firebase';
import { pokerApi } from './api';
import { useToast } from '@/hooks/use-toast';
import { useUserContext } from '@/context/UserContext';
import { ToolHubLayout } from '@/components/shared/ToolHubLayout';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from '@/lib/utils';

const ROOMS_META_KEY = 'agileSpace_rooms_meta';

export default function PokerHubPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { user } = useFirebase();
  const { userProfile, requestIdentity } = useUserContext();

  const [isSetupOpen, setIsSetupOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  
  const [rooms, setRooms] = useState<any[]>([]);
  const [loadingRooms, setLoadingRooms] = useState(true);

  // Setup State
  const [title, setTitle] = useState('');
  const [team, setTeam] = useState('');
  const [teamTouched, setTeamTouched] = useState(false);
  const [mode, setMode] = useState<'sync' | 'async'>('sync');
  const [deckType, setDeckType] = useState('hours');
  const [templates, setTemplates] = useState<PokerTemplate[]>([]);
  const [templateId, setTemplateId] = useState('');
  // Configs do facilitador pré-ativáveis no próprio modal (default off).
  // O modal mostra TODOS os toggles que a sala vai levar, já no estado em que
  // vão nascer — antes só três apareciam e o facilitador não tinha como saber
  // o que estava ligado sem entrar na sala e abrir as configurações.
  const [setupSettings, setSetupSettings] = useState<Record<string, boolean>>({
    ...DEFAULT_ROOM_SETTINGS,
    allowManagementToVote: false,
    autoReveal: false,
    autoConsensus: false,
  });
  const [hoveredDeck, setHoveredDeck] = useState<string | null>(null);
  // Equivalência numérica por tamanho (só relevante pro deck de camisetas).
  const [tshirtEquivalents, setTshirtEquivalents] = useState<Record<string, { value: string; unit: TshirtUnit }>>({});

  // Carrega templates ao abrir o setup (localStorage; evita mismatch de SSR).
  useEffect(() => {
    if (isSetupOpen) setTemplates(listTemplates());
  }, [isSetupOpen]);

  // Preenche o squad com o time do usuário assim que o perfil carregar do
  // Firestore (chega async) — só se o campo ainda não foi editado à mão.
  useEffect(() => {
    if (teamTouched) return;
    const userTeam = userProfile?.squadId || userProfile?.team;
    if (userTeam) setTeam(userTeam);
  }, [userProfile, teamTouched]);

  useEffect(() => {
    const fetchRooms = async () => {
      try {
        const data = await pokerApi.listRooms();
        setRooms(data);
      } catch (err) {
        console.error("Erro ao listar salas", err);
      } finally {
        setLoadingRooms(false);
      }
    };
    fetchRooms();
  }, []);

  const SETUP_TOTAL = SETUP_GROUPS.reduce((n, g) => n + g.items.length, 0);
  const activeSetupCount = Object.values(setupSettings).filter(Boolean).length;

  const mySquadRooms = rooms.filter(r => r.team && r.team === (userProfile?.squadId || userProfile?.team));
  const myParticipatedRooms = rooms.filter(r => user?.uid && (r.participantIds?.includes(user.uid) || r.creatorId === user.uid));

  const genId = () => (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2));

  const saveRoomMeta = (id: string, type: string, title: string, team: string) => {
    try {
      const saved = localStorage.getItem(ROOMS_META_KEY);
      const rooms = saved ? JSON.parse(saved) : [];
      const newMeta = {
        roomId: id,
        type,
        title,
        team,
        createdBy: user?.uid,
        createdAt: new Date().toISOString()
      };
      localStorage.setItem(ROOMS_META_KEY, JSON.stringify([...rooms, newMeta]));
    } catch (e) {
      console.error("Erro ao salvar metadados da sala", e);
    }
  };

  const handleCreate = async () => {
    if (isCreating) return;

    if (!user || !user.uid) {
      console.error("[poker] Tentativa de criação de sala abortada: usuário nulo ou sem ID.");
      toast({
        title: "Perfil Não Identificado",
        description: "Não foi possível carregar a sua identidade. Por favor, defina seu perfil e tente novamente.",
        variant: "destructive"
      });
      return;
    }

    if (!title.trim()) {
      toast({
        title: "Título Obrigatório",
        description: "Dê um nome à sua sala antes de iniciar.",
        variant: "destructive"
      });
      return;
    }

    setIsCreating(true);

    // Se um template foi escolhido, herda deck+configurações+backlog.
    const tpl = templates.find(t => t.id === templateId);
    const backlogIssues = tpl
      ? tpl.backlog.map((b, idx) => ({
          id: genId(),
          title: b.title,
          key: null,
          jiraLink: b.jiraLink || '',
          status: idx === 0 ? 'active' : 'pending',
          estimatedPoints: null,
          type: b.type || 'dev',
        }))
      : [];

    // Só grava a equivalência dos tamanhos que o facilitador preencheu com
    // um número válido (> 0); o resto fica de fora do objeto salvo.
    const tshirtEquivalentsClean = Object.fromEntries(
      Object.entries(tshirtEquivalents)
        .filter(([, v]) => v.value && Number(v.value) > 0)
        .map(([k, v]) => [k, { value: Number(v.value), unit: v.unit }])
    );

    const roomId = crypto.randomUUID();
    const newRoom = {
      id: roomId,
      votesRevealed: false,
      creatorId: user.uid,
      timer: { status: 'stopped', endTime: null, initialDuration: 120, remainingOnPause: 120 },
      title: title.trim(),
      team: team.trim() || 'Squad Geral',
      createdAt: new Date().toISOString(),
      issuesQueue: backlogIssues,
      activeIssueId: backlogIssues[0]?.id || null,
      participantIds: [user.uid],
      mode,
      deckType,
      revealedIssues: [],
      settings: {
        ...DEFAULT_ROOM_SETTINGS,
        ...(tpl ? tpl.settings : {}),
        ...setupSettings,
        ...(Object.keys(tshirtEquivalentsClean).length ? { tshirtEquivalents: tshirtEquivalentsClean } : {}),
      }
    };

    try {
      const docRef = await pokerApi.saveOrUpdateRoom(newRoom);
      if (docRef && docRef.id) {
        saveRoomMeta(docRef.id, 'poker', title.trim(), team.trim() || 'Squad');
        setIsSetupOpen(false);
        router.push(`/room/${docRef.id}`);
      } else {
        console.error("[poker] Resposta da API ao criar sala não veio com ID válido:", docRef);
        setIsCreating(false);
        toast({
          title: "Erro na Criação",
          description: "O servidor não retornou um ID para a nova sala.",
          variant: "destructive"
        });
      }
    } catch (error: any) {
      console.error("Error creating poker room: ", error);
      setIsCreating(false);
      toast({
        title: "Erro na Criação",
        description: error?.message || "Não foi possível iniciar a sala no momento.",
        variant: "destructive"
      });
    }
  };

  const tips = [
    {
      title: "Evite Ancoragem",
      description: "A votação deve ser silenciada até que todos tenham votado. Isso evita que o chute do sênior domine os restantes.",
      icon: <Lock className="text-violet-600" />
    },
    {
      title: "Explique Desvios",
      description: "Quando os votos divergem muito, peça para quem votou mais alto e mais baixo explicarem suas visões técnicos.",
      icon: <MessageSquare className="text-violet-600" />
    },
    {
      title: "Consenso é o Alvo",
      description: "O objetivo não é a média, mas o consenso. Continue refinando até que o time entenda a complexidade real.",
      icon: <Trophy className="text-violet-600" />
    }
  ];

  const referenceSections = [
    {
      title: "Criação & Pauta",
      label: "Preparação",
      description: "Adicione as tarefas, links do Jira e notas técnicas. Uma pauta bem definida é o primeiro passo para um refinamento ágil.",
      icon: <ListPlus className="text-violet-500" />
    },
    {
      title: "Escolha do Deck",
      label: "Calibração",
      description: "Selecione entre Horas (ideal para sub-tarefas) ou Fibonacci (ideal para User Stories). O deck certo muda o foco da squad.",
      icon: <Zap className="text-violet-500" />
    },
    {
      title: "Votação Silenciosa",
      label: "Sem Ancoragem",
      description: "Os votos permanecem ocultos até a revelação. Isso força o pensamento independente e evita que as opiniões dominantes silenciem o time.",
      icon: <Shield className="text-violet-500" />
    },
    {
      title: "Consenso de Elite",
      label: "Alinhamento",
      description: "Revele os votos, debata as divergências e salve o consenso. O objetivo não é o número, mas o entendimento real da complexidade.",
      icon: <Trophy className="text-violet-500" />
    }
  ];

  return (
    <>
      <ToolHubLayout 
        title="Scrum Poker"
        description="Estimativas precisas através de votação síncrona sem influência externa. Acerte o alvo na complexidade do seu backlog."
        icon={<WalletCards />}
        themeColor="violet"
        toolType="poker"
        tips={tips}
        referenceSections={referenceSections}
        onNewSession={() => {
          if (!user) {
            requestIdentity(() => setIsSetupOpen(true));
          } else {
            setIsSetupOpen(true);
          }
        }}
        onJoinSession={(id) => router.push(`/room/${id}`)}
        isCreating={isCreating}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
          <div className="space-y-4">
            <h3 className="text-xl font-bold">Sessões da Minha Squad</h3>
            {loadingRooms ? <p>Carregando...</p> : mySquadRooms.length === 0 ? <p className="text-muted-foreground">Nenhuma sessão encontrada.</p> : mySquadRooms.map(r => (
               <div key={r.id} className="p-4 border rounded shadow cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-900" onClick={() => router.push(`/room/${r.id}`)}>
                 <h4 className="font-bold">{r.title}</h4>
                 <p className="text-sm text-gray-500">{r.team}</p>
               </div>
            ))}
          </div>
          <div className="space-y-4">
            <h3 className="text-xl font-bold">Minhas Sessões Participadas</h3>
            {loadingRooms ? <p>Carregando...</p> : myParticipatedRooms.length === 0 ? <p className="text-muted-foreground">Nenhuma sessão encontrada.</p> : myParticipatedRooms.map(r => (
               <div key={r.id} className="p-4 border rounded shadow cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-900" onClick={() => router.push(`/room/${r.id}`)}>
                 <h4 className="font-bold">{r.title}</h4>
                 <p className="text-sm text-gray-500">{r.team}</p>
               </div>
            ))}
          </div>
        </div>
      </ToolHubLayout>

      <Dialog open={isSetupOpen} onOpenChange={setIsSetupOpen}>
        <DialogContent className="sm:max-w-[1100px] max-h-[94vh] overflow-y-auto gap-2 p-5 sm:p-6 rounded-[2rem] border border-border shadow-2xl bg-card text-card-foreground">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black uppercase tracking-tighter text-foreground leading-none">Configurar Sessão</DialogTitle>
            <DialogDescription className="text-xs font-bold text-muted-foreground uppercase tracking-widest mt-1.5">Nomeie a sala, escolha o baralho e o modo — dá pra ajustar tudo depois no painel do facilitador</DialogDescription>
          </DialogHeader>

          {templates.length > 0 && (
            <div className="space-y-2 px-1 pt-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1 flex items-center gap-1.5">
                <ListPlus className="h-3.5 w-3.5 text-primary" />
                Começar de um template
              </Label>
              <Select value={templateId || 'none'} onValueChange={(v) => {
                if (v === 'none') { setTemplateId(''); return; }
                setTemplateId(v);
                const t = templates.find(tp => tp.id === v);
                if (t) {
                  setDeckType(t.deckType);
                  // Sincroniza os toggles rápidos com o template (os demais
                  // campos do template entram no create).
                  // Template manda: cada toggle exibido passa a refletir o que
                  // ele traz (ausente = desligado), senão o modal mostraria uma
                  // coisa e a sala nasceria com outra.
                  setSetupSettings(prev => {
                    const next: Record<string, boolean> = {};
                    Object.keys(prev).forEach(k => { next[k] = !!(t.settings as any)?.[k]; });
                    return next;
                  });
                }
              }}>
                <SelectTrigger className="h-11 rounded-2xl border-border bg-muted/40 font-bold focus:ring-primary">
                  <SelectValue placeholder="Sessão em branco" />
                </SelectTrigger>
                <SelectContent className="rounded-xl font-bold">
                  <SelectItem value="none">Sessão em branco</SelectItem>
                  {templates.map(t => (
                    <SelectItem key={t.id} value={t.id}>{t.name} · {t.backlog.length} tarefa(s)</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Nome + squad */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 font-sans">
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1 flex items-center gap-1.5">
                <ListPlus className="h-3.5 w-3.5 text-primary" /> Título da Sala
              </Label>
              <Input placeholder="Ex: Refinamento Sprint #50" value={title} onChange={e => setTitle(e.target.value)}
                className="h-11 rounded-2xl border-border focus:border-primary font-bold bg-muted/40 focus-visible:ring-primary" />
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1 flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5 text-primary" /> Squad / Time
              </Label>
              <Input placeholder="Ex: Guardians of Flight" value={team} onChange={e => { setTeam(e.target.value); setTeamTouched(true); }}
                className="h-11 rounded-2xl border-border focus:border-primary font-bold bg-muted/40 focus-visible:ring-primary" />
            </div>
          </div>

          {/* Baralho — cartões visuais */}
          <div className="space-y-2 pt-3 font-sans">
            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1 flex items-center gap-1.5">
              <WalletCards className="h-3.5 w-3.5 text-primary" /> Tipo de Baralho
            </Label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {DECK_OPTIONS.map(opt => {
                const selected = deckType === opt.key;
                return (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => setDeckType(opt.key)}
                    onMouseEnter={() => setHoveredDeck(opt.key)}
                    onMouseLeave={() => setHoveredDeck(null)}
                    onFocus={() => setHoveredDeck(opt.key)}
                    className={cn(
                      "text-left p-3.5 rounded-2xl border-2 transition-all group",
                      selected ? "border-primary bg-primary/10 shadow-lg shadow-primary/10" : "border-border bg-muted/30 hover:border-primary/40 hover:bg-primary/5"
                    )}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-sm font-black uppercase tracking-tight text-foreground">{opt.name}</span>
                      <span className={cn("text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full", selected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>{opt.tagline}</span>
                    </div>
                    <div className="flex flex-wrap gap-1 mb-2">
                      {opt.sample.map(v => (
                        <span key={v} className={cn("min-w-[24px] h-6 px-1.5 flex items-center justify-center rounded-lg text-[11px] font-black border", selected ? "bg-background border-primary/30 text-primary" : "bg-background border-border text-muted-foreground")}>{v}</span>
                      ))}
                    </div>
                    <p className="text-[10px] font-medium text-muted-foreground leading-snug">{opt.desc}</p>
                  </button>
                );
              })}
            </div>
            {/* Preview do baralho completo (hover/foco no cartão, ou o selecionado) */}
            <div className="flex items-center gap-2 flex-wrap px-1 pt-1 min-h-[28px]">
              <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mr-1">Baralho completo:</span>
              {(DECKS[(hoveredDeck || deckType) as keyof typeof DECKS] || []).map((v, i) => (
                <span key={`${v}-${i}`} className="min-w-[24px] h-6 px-1.5 flex items-center justify-center rounded-md text-[10px] font-black bg-muted text-muted-foreground border border-border">{v}</span>
              ))}
            </div>
          </div>

          {deckType === 'tshirt' && (
            <div className="space-y-2 pt-3 font-sans">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1 flex items-center gap-1.5">
                <WalletCards className="h-3.5 w-3.5 text-primary" /> Equivalência de referência
                <span className="text-muted-foreground/70 normal-case tracking-normal font-medium">(opcional — preenchendo, o resultado passa a calcular de verdade)</span>
              </Label>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                {(['PP', 'P', 'M', 'G', 'GG'] as const).map(size => (
                  <div key={size} className="space-y-1">
                    <Label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground ml-1">{size}</Label>
                    <div className="flex gap-1">
                      <Input
                        type="number"
                        min="0"
                        step="0.5"
                        value={tshirtEquivalents[size]?.value || ''}
                        onChange={e => setTshirtEquivalents(s => ({ ...s, [size]: { value: e.target.value, unit: s[size]?.unit || 'hora' } }))}
                        placeholder="0"
                        className="h-9 w-14 shrink-0 rounded-xl border-border text-[11px] font-bold bg-muted/40 focus-visible:ring-primary text-center px-1"
                      />
                      <Select
                        value={tshirtEquivalents[size]?.unit || 'hora'}
                        onValueChange={(v: TshirtUnit) => setTshirtEquivalents(s => ({ ...s, [size]: { value: s[size]?.value || '', unit: v } }))}
                      >
                        <SelectTrigger className="h-9 rounded-xl border-border text-[9px] font-bold bg-muted/40 px-1.5">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl font-bold">
                          {(Object.keys(TSHIRT_UNIT_LABELS) as TshirtUnit[]).map(u => (
                            <SelectItem key={u} value={u} className="text-[11px]">{TSHIRT_UNIT_LABELS[u]}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/*
            Modo em cima (2 cards largos) e os recursos numa faixa própria de 4
            colunas. Antes os 14 toggles ficavam espremidos em meia largura, com
            scroll interno de 13rem — dava pra ver 3 de cada vez e o facilitador
            não tinha noção do conjunto, que é justamente o ponto de mostrá-los.
          */}
          <div className="pt-3 font-sans space-y-4">
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1 flex items-center gap-1.5">
                <Zap className="h-3.5 w-3.5 text-primary" /> Modo de Jogo
              </Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {MODE_OPTIONS.map(opt => {
                  const selected = mode === opt.key;
                  return (
                    <button
                      key={opt.key}
                      type="button"
                      onClick={() => setMode(opt.key)}
                      className={cn(
                        "text-left p-2.5 rounded-2xl border-2 transition-all flex items-start gap-3",
                        selected ? "border-primary bg-primary/10 shadow-lg shadow-primary/10" : "border-border bg-muted/30 hover:border-primary/40 hover:bg-primary/5"
                      )}
                    >
                      <span className="text-2xl leading-none mt-0.5">{opt.emoji}</span>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <p className="text-xs font-black uppercase tracking-tight text-foreground leading-none">{opt.name}</p>
                          <span className={cn(
                            "text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-md",
                            selected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                          )}>{opt.tagline}</span>
                        </div>
                        <p className="text-[10px] font-medium text-muted-foreground leading-snug">{opt.desc}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3 flex-wrap ml-1">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                  <Zap className="h-3.5 w-3.5 text-primary" /> Recursos da sessão
                  <span className="text-muted-foreground/70 normal-case tracking-normal font-medium">
                    ({activeSetupCount} de {SETUP_TOTAL} ligados)
                  </span>
                </Label>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setSetupSettings({ ...DEFAULT_ROOM_SETTINGS, allowManagementToVote: false, autoReveal: false, autoConsensus: false })}
                    className="text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors"
                  >
                    Padrão
                  </button>
                  <button
                    type="button"
                    onClick={() => setSetupSettings(s => Object.fromEntries(Object.keys(s).map(k => [k, false])))}
                    className="text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors"
                  >
                    Nenhum
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-3 gap-y-3">
                {SETUP_GROUPS.map(group => (
                  <div key={group.label} className="space-y-1.5">
                    <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/60 ml-1">{group.label}</p>
                    {group.items.map(cfg => {
                      const on = !!setupSettings[cfg.key];
                      return (
                        <div
                          key={cfg.key}
                          onClick={() => setSetupSettings(s => ({ ...s, [cfg.key]: !on }))}
                          title={cfg.desc}
                          className={cn(
                            "w-full text-left px-2.5 py-2 rounded-xl border-2 flex items-center justify-between gap-2 transition-all cursor-pointer",
                            on ? "border-primary bg-primary/10" : "border-border bg-muted/30 hover:border-primary/30"
                          )}
                        >
                          <span className="min-w-0">
                            <span className="block text-[10px] font-black uppercase tracking-tight text-foreground leading-tight">{cfg.title}</span>
                            <span className="block text-[9px] font-medium text-muted-foreground leading-tight mt-0.5">{cfg.desc}</span>
                          </span>
                          <Switch checked={on} className="pointer-events-none shrink-0 scale-90" />
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter className="pt-4 mt-1 border-t border-border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
             <button
               onClick={() => setIsSetupOpen(false)}
               className="text-[10px] font-black uppercase tracking-widest text-muted-foreground hover:text-muted-foreground transition-colors text-center sm:text-left order-2 sm:order-1"
             >
                Cancelar
             </button>
             <Button
               disabled={isCreating}
               onClick={handleCreate}
               className="w-full sm:w-auto px-8 h-12 bg-primary hover:bg-primary/90 text-primary-foreground font-black uppercase tracking-widest text-xs rounded-2xl shadow-xl shadow-primary/10 gap-3 order-1 sm:order-2"
             >
               {isCreating ? 'Preparando...' : 'Criar Sala'}
               <ArrowRightIcon className="h-4 w-4" />
             </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

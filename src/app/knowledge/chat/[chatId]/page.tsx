"use client";

import React, { useEffect, useRef, useState, useCallback, use, Suspense } from 'react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Send,
  Bot,
  User,
  Copy,
  Trash2,
  Paperclip,
  Plus,
  X,
  ChevronRight,
  Menu,
  Download,
  Loader2,
  AlertCircle,
  Settings
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { InitialsAvatar } from '@/components/common/InitialsAvatar';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/AuthContext';
import { useTdnSettings } from '@/hooks/useTdnSettings';
import { searchKnowledgeBase } from '@/services/oracleService';
import { searchTdn, TdnSearchResult, getTdnPageContent, importTdnToKnowledgeBase } from '@/services/tdnService';
import { KnowledgeDocument } from '@/lib/knowledge-types';
import { knowledgeChatApi, KnowledgeConversationDTO } from '../api';
import { knowledgeApi } from '@/app/knowledge/api';
import { useRouter } from 'next/navigation';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetDescription,
} from "@/components/ui/sheet";
import { authFetch } from '@/lib/auth-client';

const FOCUS = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp?: number;
  docs?: KnowledgeDocument[];
  tdnResults?: TdnSearchResult[];
}

// O backend só aceita UUID em /conversations/{id}. A landing gera um slug curto local (e "new" também
// chega aqui), que ainda não existe no backend: buscar só geraria um 400 inútil.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function buildTitle(prompt: string): string {
  return prompt.slice(0, 30) + (prompt.length > 30 ? '...' : '');
}

/** Deriva uma prévia curta a partir do blob JSON de mensagens da conversa, para exibir na sidebar. */
function getPreview(conv: KnowledgeConversationDTO): string {
  try {
    const parsed = conv.messages ? JSON.parse(conv.messages) : [];
    if (!Array.isArray(parsed) || parsed.length === 0) return '';
    const last = parsed[parsed.length - 1];
    return typeof last?.content === 'string' ? last.content : '';
  } catch {
    return '';
  }
}

function ChatContent({ chatId }: { chatId: string }) {
  const router = useRouter();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const { session } = useAuth();
  const { settings: tdnSettings } = useTdnSettings();
  const [userApiKey, setUserApiKey] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [conversations, setConversations] = useState<KnowledgeConversationDTO[]>([]);
  // ID real da conversa no backend. Null enquanto a conversa ainda não existe lá
  // (ex.: chatId veio da tela de landing, que gera um slug local antes de qualquer persistência).
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const isMounted = useRef(true);
  // Evita que o refetch de loadConversation (disparado pelo router.replace logo
  // abaixo, ao criar a conversa) sobrescreva com um snapshot antigo do backend
  // (só a msg do usuário) o setMessages(finalMessages) que ainda vai rodar com
  // a resposta do assistente já embutida.
  const skipNextLoadRef = useRef(false);

  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  // Carregar chave de API (configurações de IA do usuário)
  useEffect(() => {
    async function loadKey() {
      if (!session) return;
      try {
        const settings = await knowledgeChatApi.getAiSettings();
        if (isMounted.current) setUserApiKey(settings.byokApiKey || null);
      } catch (e) {}
    }
    loadKey();
  }, [session]);

  const refreshConversations = useCallback(async () => {
    if (!session) return;
    try {
      const list = await knowledgeChatApi.listConversations();
      if (isMounted.current) setConversations(list);
    } catch (e) {}
  }, [session]);

  // Carregar lista de conversas
  useEffect(() => {
    refreshConversations();
  }, [refreshConversations]);

  // Carregar a conversa atual do backend. Se o chatId não corresponder a uma
  // conversa persistida ainda (ex.: slug recém-gerado pela landing page),
  // segue com a sessão vazia — ela será criada no backend no primeiro envio.
  useEffect(() => {
    let cancelled = false;
    async function loadConversation() {
      if (!session) return;
      if (skipNextLoadRef.current) {
        skipNextLoadRef.current = false;
        return;
      }
      if (!UUID_RE.test(chatId)) {
        setConversationId(null);
        setMessages([]);
        return;
      }
      try {
        const conv = await knowledgeChatApi.getConversation(chatId);
        if (cancelled) return;
        setConversationId(conv.id);
        setMessages(conv.messages ? JSON.parse(conv.messages) : []);
      } catch (e) {
        if (cancelled) return;
        setConversationId(null);
        setMessages([]);
      }
    }
    loadConversation();
    return () => { cancelled = true; };
  }, [chatId, session]);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  const createNewChat = async () => {
    if (!session) return;
    try {
      const created = await knowledgeChatApi.createConversation('Nova Consulta de Conhecimento');
      refreshConversations();
      router.push(`/knowledge/chat/${created.id}`);
    } catch (e) {
      toast({ title: "Erro", description: "Falha ao criar chat.", variant: "destructive" });
    }
  };

  const deleteConversation = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    try {
      await knowledgeChatApi.deleteConversation(id);
      if (id === chatId) router.push('/knowledge/chat/new');
      setConversations(prev => prev.filter(c => c.id !== id));
      toast({ title: "Removido", description: "Sessão deletada." });
    } catch (e) {
      toast({ title: "Não foi possível excluir", description: "A conversa continua na lista. Tente de novo.", variant: "destructive" });
    }
  };

  const onFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const prompt = input.trim();
    const userMsg: ChatMessage = { id: Date.now().toString(), role: 'user', content: prompt, timestamp: Date.now() };
    const wasEmpty = messages.length === 0;
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    setIsLoading(true);

    // Garante que a conversa exista no backend antes de persistir mensagens:
    // cria-a com o título derivado do primeiro prompt, ou renomeia uma
    // conversa já existente mas ainda vazia (equivalente ao antigo rename automático).
    let activeConversationId = conversationId;
    try {
      if (!activeConversationId) {
        const created = await knowledgeChatApi.createConversation(buildTitle(prompt));
        activeConversationId = created.id;
        setConversationId(created.id);
        skipNextLoadRef.current = true;
        router.replace(`/knowledge/chat/${created.id}`);
      } else if (wasEmpty) {
        await knowledgeChatApi.renameConversation(activeConversationId, buildTitle(prompt));
      }
    } catch (e) {
      // Segue com a conversa em memória mesmo se a persistência falhar, mas avisa.
      toast({ title: "Histórico não salvo", description: "Não foi possível guardar esta conversa; ela vale só até recarregar a página.", variant: "destructive" });
    }

    // Grava a pergunta junto com a resposta: se a resposta falhar, não sobra pergunta órfã no histórico.
    const persistTurn = async (assistantMsg: ChatMessage) => {
      if (!activeConversationId) return;
      try {
        await knowledgeChatApi.appendMessage(activeConversationId, userMsg);
        await knowledgeChatApi.appendMessage(activeConversationId, assistantMsg);
      } catch (e) {
        toast({ title: "Histórico não salvo", description: "A resposta apareceu, mas não foi guardada no histórico.", variant: "destructive" });
      }
    };

    if (!userApiKey) {
      try {
        // Busca semântica local (embedding via transformers.js, sem LLM) primeiro;
        // cai para busca por palavra-chave se vier vazia ou o endpoint falhar.
        let localResults: KnowledgeDocument[] = [];
        try {
          const semanticRes = await knowledgeApi.semanticSearch(prompt, 10);
          localResults = semanticRes?.content || [];
        } catch (e) {
          console.error('Erro na busca semântica, caindo para busca por palavra-chave:', e);
        }
        if (localResults.length === 0) {
          localResults = await searchKnowledgeBase(undefined, prompt);
        }
        let tdnResults: TdnSearchResult[] = [];
        if (tdnSettings?.baseUrl && tdnSettings?.token) {
          try {
            tdnResults = await searchTdn(tdnSettings.baseUrl, tdnSettings.token, prompt, tdnSettings.space, tdnSettings.label);
          } catch (e) {
            console.error('Error searching TDN:', e);
          }
        }

        let content = '';
        if (localResults.length > 0 || tdnResults.length > 0) {
          content = `Sua chave de acesso ao motor não está configurada, então realizei uma busca diretamente nas suas bases de conhecimento (Local e TDN). Aqui estão os documentos mais relevantes encontrados:`;
        } else {
          content = `Sua chave de acesso ao motor não está configurada e não encontramos resultados diretos na Base Local nem no TDN. Por favor, configure sua chave de API nas configurações.`;
        }

        const assistantMsg: ChatMessage = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content,
          timestamp: Date.now(),
          docs: localResults,
          tdnResults
        };

        const finalMessages = [...newMessages, assistantMsg];
        setMessages(finalMessages);

        await persistTurn(assistantMsg);
      } catch (err: any) {
         setMessages(messages);
         setInput(prompt);
         toast({ title: "Erro na Busca", description: "Falha ao buscar nas bases. Sua pergunta foi mantida na caixa de texto.", variant: "destructive" });
      } finally {
        setIsLoading(false);
        refreshConversations();
      }
      return;
    }

    try {
      const response = await authFetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // Só papel e texto: mensagens antigas do modo sem chave carregam listas de documentos inteiras.
        body: JSON.stringify({
          messages: newMessages.map(m => ({ role: m.role, content: m.content })),
          apiKey: userApiKey,
        })
      });
      if (!response.ok) {
        const errBody = await response.json().catch(() => null);
        throw new Error(errBody?.message || errBody?.error || `O assistente não respondeu (erro ${response.status}).`);
      }
      const data = await response.json();
      const assistantMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: String(data.content || data.text || '')
      };
      const finalMessages = [...newMessages, assistantMsg];
      setMessages(finalMessages);

      await persistTurn(assistantMsg);

      // Registrar uso de tokens no backend (substitui o antigo write direto no Firestore)
      if (session && data.usage) {
        try {
          const tokens = (data.usage.promptTokens || 0) + (data.usage.completionTokens || 0);
          await knowledgeChatApi.incrementTokenUsage(tokens);
        } catch (usageErr: any) {
          console.warn("⚠️ [Chat] Falha ao registrar tokens:", usageErr.message);
        }
      }
    } catch (err: any) {
      // Devolve a pergunta à caixa de texto: quem digitou não precisa reescrever.
      setMessages(messages);
      setInput(prompt);
      toast({ title: "Erro no assistente", description: err.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
      refreshConversations();
    }
  };

  const handleImport = async (tdnResult: TdnSearchResult) => {
    if (!tdnSettings || !session) return;

    setIsImporting(tdnResult.id);
    try {
      const fullContent = await getTdnPageContent(tdnSettings.baseUrl, tdnSettings.token, tdnResult.id);
      await importTdnToKnowledgeBase(session.id, {
        id: fullContent.id,
        title: fullContent.title,
        content: fullContent.content,
        space: fullContent.space,
        link: fullContent.link,
        labels: fullContent.labels || tdnResult.labels || []
      });
      toast({ title: "Documento Importado!" });
    } catch (err: any) {
      toast({ title: "Erro na Importação", description: err?.message, variant: "destructive" });
    } finally {
      setIsImporting(null);
    }
  };

  return (
    <div className="relative flex h-full w-full overflow-hidden bg-background text-foreground">

      {/* Barra lateral persistente com as conversas */}
      <aside className={cn(
        "hidden shrink-0 flex-col overflow-hidden border-r border-border bg-card/60 md:flex motion-safe:transition-all motion-safe:duration-300",
        isSidebarOpen ? "w-72" : "w-0"
      )}>
        <div className="flex h-full min-w-[288px] flex-col gap-4 p-5">
          <Button
            onClick={createNewChat}
            variant="outline"
            className={cn("h-11 w-full gap-2 rounded-[10px] border-border bg-background text-sm font-semibold text-foreground hover:bg-muted", FOCUS)}
          >
            <Plus className="h-4 w-4 text-primary" aria-hidden="true" /> Nova consulta
          </Button>

          <div className="mt-2 flex flex-1 flex-col overflow-hidden">
            <h2 className="mb-3 px-2 text-sm font-semibold text-muted-foreground">Recentes</h2>
            <ScrollArea className="-mx-2 flex-1 px-2">
              <ul className="space-y-1">
                {conversations.map((conv) => (
                  <li
                    key={conv.id}
                    className={cn(
                      "group relative rounded-xl border border-transparent motion-safe:transition-colors",
                      chatId === conv.id ? "border-border bg-background" : "hover:bg-muted/60"
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => router.push(`/knowledge/chat/${conv.id}`)}
                      aria-current={chatId === conv.id ? 'page' : undefined}
                      className={cn("block w-full min-w-0 rounded-xl p-3 pr-10 text-left", FOCUS)}
                    >
                      <span className={cn("block truncate text-sm font-semibold", chatId === conv.id ? "text-primary" : "text-foreground")}>
                        {conv.title}
                      </span>
                      <span className="mt-0.5 block truncate text-[0.8125rem] text-muted-foreground">{getPreview(conv)}</span>
                    </button>
                    <button
                      type="button"
                      onClick={(e) => deleteConversation(e, conv.id)}
                      aria-label={`Excluir a conversa ${conv.title}`}
                      className={cn("absolute right-2 top-2.5 rounded-md p-1.5 text-muted-foreground opacity-0 hover:text-destructive focus-visible:opacity-100 group-hover:opacity-100 motion-safe:transition-opacity", FOCUS)}
                    >
                      <X className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
            </ScrollArea>
          </div>

          <div className="border-t border-border pt-4">
            <Button
              variant="ghost"
              onClick={() => setMessages([])}
              className={cn("mb-4 h-10 w-full gap-2 rounded-[10px] text-sm text-muted-foreground hover:bg-destructive/10 hover:text-destructive", FOCUS)}
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" /> Limpar conversa
            </Button>
            <div className="flex items-center gap-3 px-2">
              <InitialsAvatar name={session?.name} className="h-8 w-8 text-xs" />
              <span className="min-w-0 truncate text-sm font-medium text-foreground">{session?.name || 'Usuário'}</span>
            </div>
          </div>
        </div>
      </aside>

      <div className="relative flex h-full min-w-0 flex-1 flex-col bg-background">

        {/* Gatilho da barra lateral no celular (flutuante) */}
        <div className="absolute left-4 top-4 z-50 md:hidden">
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon" aria-label="Abrir conversas" className={cn("h-10 w-10 rounded-[10px] border-border bg-card/90 text-foreground backdrop-blur-md", FOCUS)}>
                <Menu className="h-5 w-5" aria-hidden="true" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[300px] border-r border-border bg-card p-0">
              <SheetHeader className="sr-only">
                <SheetTitle>Conversas</SheetTitle>
                <SheetDescription>Suas consultas recentes ao assistente virtual.</SheetDescription>
              </SheetHeader>
              <div className="flex h-full flex-col gap-6 p-6">
                <Button onClick={createNewChat} variant="outline" className={cn("h-12 w-full gap-2 rounded-[10px] border-border bg-background text-sm font-semibold text-foreground hover:bg-muted", FOCUS)}>
                  <Plus className="h-4 w-4 text-primary" aria-hidden="true" /> Nova consulta
                </Button>
                <ScrollArea className="flex-1">
                  <ul className="space-y-1">
                    {conversations.map((conv) => (
                      <li key={conv.id}>
                        <button
                          type="button"
                          onClick={() => router.push(`/knowledge/chat/${conv.id}`)}
                          aria-current={chatId === conv.id ? 'page' : undefined}
                          className={cn("block w-full rounded-xl p-3 text-left text-sm font-semibold", FOCUS, chatId === conv.id ? "border border-border bg-background text-primary" : "text-foreground hover:bg-muted/60")}
                        >
                          {conv.title}
                        </button>
                      </li>
                    ))}
                  </ul>
                </ScrollArea>
                <div className="border-t border-border pt-4">
                  <Button
                    variant="ghost"
                    onClick={() => setMessages([])}
                    className={cn("h-10 w-full gap-2 rounded-[10px] text-sm text-muted-foreground hover:bg-destructive/10 hover:text-destructive", FOCUS)}
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" /> Limpar conversa
                  </Button>
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>

        {/* Área da conversa */}
        <ScrollArea className="flex-1">
          <div className="mx-auto max-w-4xl space-y-8 px-4 py-10 md:px-6">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center space-y-6 py-16 text-center">
                <div className="flex h-20 w-20 items-center justify-center rounded-3xl border border-border bg-card">
                  <Bot className="h-10 w-10 text-primary" aria-hidden="true" />
                </div>
                <div className="space-y-2">
                  <h2 className="text-3xl font-bold tracking-tight text-foreground">O que vamos descobrir hoje?</h2>
                  <p className="text-sm text-muted-foreground">Assistente de Agilidade • Portal Tech V&amp;D</p>
                </div>

                <div className="mt-6 grid w-full max-w-2xl grid-cols-1 gap-3 md:grid-cols-2">
                  {[
                    "Quais os processos de deploy?",
                    "Como funciona o Scrum Poker?",
                    "Quais as regras da Governança?",
                    "Explique o motor Jolt."
                  ].map(suggestion => (
                    <button
                      key={suggestion}
                      type="button"
                      onClick={() => { setInput(suggestion); }}
                      className={cn("rounded-2xl border border-border bg-card p-4 text-left text-sm font-medium text-foreground hover:border-primary hover:bg-muted/50 motion-safe:transition-colors", FOCUS)}
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m) => (
              <div
                key={m.id}
                className={cn(
                  "group flex w-full gap-4",
                  m.role === 'user' ? "flex-row-reverse" : "flex-row"
                )}
              >
                <div
                  aria-hidden="true"
                  className={cn(
                    "flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-border",
                    m.role === 'user' ? "bg-muted text-foreground" : "bg-card text-primary"
                  )}
                >
                  {m.role === 'user' ? <User className="h-5 w-5" /> : <Bot className="h-5 w-5" />}
                </div>

                <div className={cn(
                  "flex max-w-[85%] flex-col gap-2 md:max-w-[80%]",
                  m.role === 'user' ? "items-end" : "items-start"
                )}>
                  <div className={cn(
                    "relative rounded-2xl px-5 py-4 text-sm leading-relaxed text-foreground",
                    m.role === 'user'
                      ? "rounded-tr-md bg-muted"
                      : "rounded-tl-md border border-border bg-card"
                  )}>
                    <div className="whitespace-pre-wrap break-words">{m.content}</div>

                    {/* Documentos e resultados */}
                    {(m.docs || m.tdnResults) && (
                      <div className="mt-5 space-y-4 border-t border-border pt-5">
                        {m.docs && m.docs.length > 0 && (
                          <div className="space-y-3">
                            <div className="flex items-center gap-2">
                              <div className="h-2 w-2 rounded-full bg-primary" aria-hidden="true" />
                              <span className="text-sm font-semibold text-foreground">Documentação local</span>
                            </div>
                            <ul className="grid gap-2">
                              {m.docs.map((docItem) => (
                                <li key={docItem.id}>
                                  <button
                                    type="button"
                                    onClick={() => window.open(`/knowledge/kb?id=${docItem.id}`, '_blank')}
                                    className={cn("group/card flex w-full items-center justify-between gap-3 rounded-xl border border-border bg-background p-4 text-left hover:border-primary hover:bg-muted/40 motion-safe:transition-colors", FOCUS)}
                                  >
                                    <span className="min-w-0">
                                      <span className="block text-sm font-semibold text-foreground">{docItem.title}</span>
                                      <span className="mt-1 line-clamp-1 block text-[0.8125rem] text-muted-foreground">{docItem.category || 'Wiki'}</span>
                                    </span>
                                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground group-hover/card:text-primary motion-safe:transition-transform motion-safe:group-hover/card:translate-x-1" aria-hidden="true" />
                                  </button>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {m.tdnResults && m.tdnResults.length > 0 && (
                          <div className="space-y-3">
                            <div className="flex items-center gap-2">
                              <div className="h-2 w-2 rounded-full bg-foreground" aria-hidden="true" />
                              <span className="text-sm font-semibold text-foreground">Base de conhecimento do TDN</span>
                            </div>
                            <ul className="grid gap-2">
                              {m.tdnResults.map((tdn) => (
                                <li
                                  key={tdn.id}
                                  className="group/tdn flex items-center justify-between gap-3 rounded-xl border border-border bg-background p-4"
                                >
                                  <button
                                    type="button"
                                    className={cn("min-w-0 flex-1 rounded-md text-left", FOCUS)}
                                    onClick={() => window.open(tdn.link, '_blank')}
                                  >
                                    <span className="block text-sm font-semibold text-foreground group-hover/tdn:text-primary">{tdn.title}</span>
                                    <span className="mt-1 flex items-center gap-2 text-[0.8125rem] text-muted-foreground">
                                      <span>{tdn.space}</span>
                                      <span className="h-1 w-1 rounded-full bg-border" aria-hidden="true" />
                                      <span>Fonte externa</span>
                                    </span>
                                  </button>
                                  <Button
                                    size="icon"
                                    variant="outline"
                                    aria-label={`Importar ${tdn.title} para a base`}
                                    title="Importar para a base"
                                    className={cn("h-9 w-9 shrink-0 rounded-[10px]", FOCUS)}
                                    onClick={() => handleImport(tdn)}
                                    disabled={isImporting === tdn.id}
                                  >
                                    {isImporting === tdn.id ? <Loader2 className="h-4 w-4 motion-safe:animate-spin" aria-hidden="true" /> : <Download className="h-4 w-4" aria-hidden="true" />}
                                  </Button>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Aviso: sem chave de IA */}
                    {m.role === 'assistant' && (m.docs || m.tdnResults) && !userApiKey && (
                      <div role="note" className="mt-5 space-y-3 rounded-xl border border-amber-500/35 bg-amber-500/10 p-4 text-foreground">
                        <div className="flex items-center gap-2">
                          <AlertCircle className="h-4 w-4 text-amber-700 dark:text-amber-400" aria-hidden="true" />
                          <span className="text-sm font-semibold text-foreground">Busca simples ativa</span>
                        </div>
                        <p className="text-sm leading-relaxed text-foreground">Sua chave de acesso ao assistente não foi detectada. Estou operando no modo de busca indexada. Para análise avançada, configure sua chave.</p>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => router.push('/knowledge/settings')}
                          className={cn("h-9 gap-2 rounded-[10px] bg-background text-sm font-semibold", FOCUS)}
                        >
                          <Settings className="h-4 w-4" aria-hidden="true" /> Configurar chave
                        </Button>
                      </div>
                    )}

                    {/* Copiar mensagem */}
                    <button
                      type="button"
                      onClick={() => { navigator.clipboard.writeText(m.content); toast({ title: "Copiado!" }); }}
                      aria-label="Copiar mensagem"
                      title="Copiar mensagem"
                      className={cn("absolute -left-10 top-2 rounded-md p-2 text-muted-foreground opacity-0 hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100 motion-safe:transition-opacity", FOCUS)}
                    >
                      <Copy className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </div>
                </div>
              </div>
            ))}

            {isLoading && (
              <div role="status" aria-label="O assistente está respondendo" className="flex gap-4 motion-safe:animate-pulse">
                <div className="h-10 w-10 rounded-2xl border border-border bg-muted" />
                <div className="max-w-md flex-1 space-y-3">
                  <div className="h-4 w-full rounded-lg bg-muted" />
                  <div className="h-4 w-5/6 rounded-lg bg-muted" />
                </div>
              </div>
            )}

            {/* Âncora para a rolagem automática */}
            <div ref={messagesEndRef} className="h-1" />
          </div>
        </ScrollArea>

        {/* Caixa de pergunta, fixa no rodapé */}
        <div className="relative z-20 shrink-0 border-t border-border bg-background/90 p-4 backdrop-blur-xl md:p-6">
          <div className="mx-auto w-full max-w-4xl">
            <form onSubmit={onFormSubmit} className="relative">
              <div className="relative flex items-center rounded-full border-2 border-border bg-card p-1.5 pl-3 motion-safe:transition-shadow focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/40">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="Anexar arquivo"
                  className={cn("h-10 w-10 shrink-0 rounded-full text-muted-foreground hover:bg-muted hover:text-foreground", FOCUS)}
                >
                  <Paperclip className="h-4 w-4" aria-hidden="true" />
                </Button>
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  aria-label="Sua pergunta"
                  placeholder="Pergunte qualquer coisa sobre o Portal Tech V&D..."
                  className="h-12 flex-1 border-none bg-transparent px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
                />
                <Button
                  type="submit"
                  disabled={isLoading || !input.trim()}
                  aria-label="Enviar pergunta"
                  className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary p-0 text-primary-foreground disabled:opacity-40", FOCUS)}
                >
                  {isLoading ? <Loader2 className="h-4 w-4 motion-safe:animate-spin" aria-hidden="true" /> : <Send className="h-4 w-4" aria-hidden="true" />}
                </Button>
              </div>
            </form>
            <p className="mt-3 text-center text-[0.8125rem] text-muted-foreground">
              Assistente de Agilidade
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ChatPage({ params }: { params: Promise<{ chatId: string }> }) {
  const { chatId } = use(params);
  return (
    <Suspense fallback={<div role="status" className="flex h-full items-center justify-center text-sm text-muted-foreground">Carregando o assistente...</div>}>
      <ChatContent chatId={chatId} />
    </Suspense>
  );
}

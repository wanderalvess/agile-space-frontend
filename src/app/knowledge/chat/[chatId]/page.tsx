"use client";

import React, { useEffect, useRef, useState, useMemo, use, Suspense } from 'react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Send, 
  Bot, 
  User, 
  RotateCcw, 
  Copy, 
  Trash2, 
  Sparkles, 
  Paperclip, 
  ShieldCheck,
  Plus,
  History,
  X,
  ChevronRight,
  Menu,
  BookOpen,
  Globe,
  Download,
  Loader2,
  AlertCircle,
  Link2,
  Settings
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { useFirebase } from '@/firebase';
import { useTdnSettings } from '@/hooks/useTdnSettings';
import { searchKnowledgeBase } from '@/services/oracleService';
import { searchTdn, TdnSearchResult, getTdnPageContent, importTdnToKnowledgeBase } from '@/services/tdnService';
import { KnowledgeDocument } from '@/lib/knowledge-types';
import { 
  doc, 
  getDoc, 
  collection, 
  query, 
  where, 
  orderBy, 
  getDocs, 
  addDoc, 
  setDoc,
  increment,
  serverTimestamp,
  deleteDoc,
  updateDoc
} from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetDescription,
} from "@/components/ui/sheet";

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp?: number;
  docs?: KnowledgeDocument[];
  tdnResults?: TdnSearchResult[];
}

function ChatContent({ chatId }: { chatId: string }) {
  const router = useRouter();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const { firestore, user } = useFirebase();
  const { settings: tdnSettings } = useTdnSettings();
  const [userApiKey, setUserApiKey] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [conversations, setConversations] = useState<any[]>([]);
  const [isImporting, setIsImporting] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  // Carregar chave de API
  useEffect(() => {
    async function loadKey() {
      if (!firestore || !user) return;
      try {
        const configDoc = await getDoc(doc(firestore, 'knowledge_user_configs', user.uid, 'ai', 'settings'));
        if (configDoc.exists()) {
          const data = configDoc.data();
          if (isMounted.current) setUserApiKey(data.geminiKey || data.apiKey || null);
        }
      } catch (e) {}
    }
    loadKey();
  }, [firestore, user]);

  // Carregar histórico local da sessão
  useEffect(() => {
    const saved = localStorage.getItem(`chat-history-${chatId}`);
    if (saved) {
      try { setMessages(JSON.parse(saved)); } catch (e) {}
    } else {
      setMessages([]);
    }
  }, [chatId]);

  useEffect(() => {
    if (messages.length > 0 && chatId !== 'new') {
      localStorage.setItem(`chat-history-${chatId}`, JSON.stringify(messages));
    }
  }, [messages, chatId]);

  // Carregar lista de conversas
  useEffect(() => {
    async function fetchConversations() {
      if (!firestore || !user) return;
      try {
        const q = query(
          collection(firestore, 'knowledge_conversations'),
          where('userId', '==', user.uid),
          orderBy('updatedAt', 'desc')
        );
        const snap = await getDocs(q);
        if (isMounted.current) setConversations(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (e) {}
    }
    fetchConversations();
  }, [firestore, user, messages]);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  const createNewChat = async () => {
    if (!firestore || !user) return;
    try {
      const newChat = await addDoc(collection(firestore, 'knowledge_conversations'), {
        userId: user.uid,
        title: 'Nova Consulta de Conhecimento',
        updatedAt: serverTimestamp(),
        createdAt: serverTimestamp(),
        lastMessage: ''
      });
      router.push(`/knowledge/chat/${newChat.id}`);
    } catch (e) {
      toast({ title: "Erro", description: "Falha ao criar chat.", variant: "destructive" });
    }
  };

  const deleteConversation = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!firestore) return;
    try {
      await deleteDoc(doc(firestore, 'knowledge_conversations', id));
      if (id === chatId) router.push('/knowledge/chat/new');
      setConversations(prev => prev.filter(c => c.id !== id));
      toast({ title: "Removido", description: "Sessão deletada." });
    } catch (e) {}
  };

  const onFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const prompt = input.trim();
    const userMsg: ChatMessage = { id: Date.now().toString(), role: 'user', content: prompt, timestamp: Date.now() };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    setIsLoading(true);

    if (!userApiKey) {
      try {
        const localResults = await searchKnowledgeBase(firestore!, prompt);
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

        if (messages.length === 0 && firestore && chatId !== 'new') {
          const title = prompt.slice(0, 30) + (prompt.length > 30 ? '...' : '');
          await updateDoc(doc(firestore, 'knowledge_conversations', chatId), {
            title, lastMessage: prompt, updatedAt: serverTimestamp()
          });
        }
      } catch (err: any) {
         toast({ title: "Erro na Busca", description: "Falha ao buscar nas bases.", variant: "destructive" });
      } finally {
        setIsLoading(false);
      }
      return;
    }

    try {
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newMessages, apiKey: userApiKey, userId: user?.uid })
      });
      if (!response.ok) throw new Error('Falha na resposta.');
      const data = await response.json();
      const assistantMsg: ChatMessage = { 
        id: (Date.now() + 1).toString(), 
        role: 'assistant', 
        content: String(data.content || data.text || '') 
      };
      const finalMessages = [...newMessages, assistantMsg];
      setMessages(finalMessages);

      // Registrar Uso de Tokens via Cliente (Autenticado)
      if (user && firestore && data.usage) {
        try {
          const usageRef = doc(firestore, 'knowledge_token_usage', user.uid);
          const monthKey = new Date().toISOString().slice(0, 7); // yyyy-mm
          
          await setDoc(usageRef, {
            userId: user.uid,
            totalPromptTokens: increment(data.usage.promptTokens || 0),
            totalCompletionTokens: increment(data.usage.completionTokens || 0),
            lastActive: serverTimestamp(),
            [`history.${monthKey}.promptTokens`]: increment(data.usage.promptTokens || 0),
            [`history.${monthKey}.completionTokens`]: increment(data.usage.completionTokens || 0),
          }, { merge: true });
        } catch (usageErr: any) {
          console.warn("⚠️ [Chat] Falha ao registrar tokens localmente:", usageErr.message);
        }
      }

      if (messages.length === 0 && firestore && chatId !== 'new') {
        const title = prompt.slice(0, 30) + (prompt.length > 30 ? '...' : '');
        await updateDoc(doc(firestore, 'knowledge_conversations', chatId), {
          title, lastMessage: prompt, updatedAt: serverTimestamp()
        });
      }
    } catch (err: any) {
      toast({ title: "Erro no Motor", description: err.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleImport = async (tdnResult: TdnSearchResult) => {
    if (!tdnSettings || !user || !firestore) return;
    
    setIsImporting(tdnResult.id);
    try {
      const fullContent = await getTdnPageContent(tdnSettings.baseUrl, tdnSettings.token, tdnResult.id);
      await importTdnToKnowledgeBase(firestore, user.uid, {
        id: fullContent.id,
        title: fullContent.title,
        content: fullContent.content,
        space: fullContent.space,
        link: fullContent.link,
        labels: fullContent.labels || tdnResult.labels || []
      });
      toast({ title: "Documento Importado!" });
    } catch (err) {
      toast({ title: "Erro na Importação", variant: "destructive" });
    } finally {
      setIsImporting(null);
    }
  };

  return (
    <div className="flex h-full w-full bg-[#fcfcfd] dark:bg-slate-950 overflow-hidden relative">
      
      {/* Sidebar Persistente Estilo Gemini/ChatGPT */}
      <aside className={cn(
        "hidden md:flex flex-col bg-slate-50/80 dark:bg-slate-900/40 backdrop-blur-xl border-r border-slate-100 dark:border-slate-800 transition-all duration-500 overflow-hidden shrink-0",
        isSidebarOpen ? "w-72" : "w-0"
      )}>
        <div className="p-5 h-full flex flex-col gap-4 min-w-[288px]">
          <Button 
            onClick={createNewChat} 
            className="w-full h-11 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl text-slate-900 dark:text-slate-100 text-[10px] font-black uppercase tracking-widest gap-2 shadow-sm"
          >
            <Plus className="h-4 w-4 text-cyan-600" /> Nova Consulta
          </Button>

          <div className="flex-1 overflow-hidden flex flex-col mt-2">
            <h3 className="text-[9px] font-black uppercase tracking-[0.3em] text-slate-400 dark:text-slate-500 px-2 mb-4">Recentes</h3>
            <ScrollArea className="flex-1 -mx-2 px-2">
              <div className="space-y-1">
                {conversations.map((conv) => (
                  <div 
                    key={conv.id} 
                    onClick={() => router.push(`/knowledge/chat/${conv.id}`)}
                    className={cn(
                      "group p-3 rounded-xl cursor-pointer transition-all border border-transparent",
                      chatId === conv.id ? "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm" : "hover:bg-slate-100/50 dark:hover:bg-slate-900/30"
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className={cn("text-[11px] font-black uppercase tracking-tight truncate", chatId === conv.id ? "text-cyan-600 dark:text-cyan-400" : "text-slate-600 dark:text-slate-400 group-hover:text-slate-900 dark:group-hover:text-slate-100")}>
                          {conv.title}
                        </p>
                        <p className="text-[9px] font-medium text-slate-500 dark:text-slate-500 truncate mt-0.5 italic">{conv.lastMessage}</p>
                      </div>
                      <button 
                        onClick={(e) => deleteConversation(e, conv.id)} 
                        className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 dark:text-slate-500 hover:text-rose-500 transition-all"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>

          <div className="pt-4 border-t border-slate-200 dark:border-slate-800">
             <Button 
               variant="ghost" 
               onClick={() => { setMessages([]); localStorage.removeItem(`chat-history-${chatId}`); }}
               className="w-full h-10 mb-4 text-slate-400 dark:text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-xl text-[9px] font-black uppercase tracking-widest gap-2 transition-all"
             >
               <Trash2 className="h-4 w-4" /> Limpar Conversa
             </Button>
             <div className="flex items-center gap-3 px-2">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-black text-xs border border-indigo-100 dark:border-indigo-900">
                   {user?.displayName?.charAt(0) || 'U'}
                </div>
                <div className="flex flex-col min-w-0">
                   <span className="text-[10px] font-black text-slate-900 dark:text-slate-100 truncate uppercase">{user?.displayName || 'Usuário'}</span>
                   <span className="text-[8px] font-bold text-slate-500 dark:text-slate-400 truncate">Acesso Avançado Pro</span>
                </div>
             </div>
          </div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0 h-full relative bg-white dark:bg-slate-950">
        
        {/* Mobile Sidebar Trigger (Floating) */}
        <div className="md:hidden absolute top-4 left-4 z-50">
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon" className="h-10 w-10 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md text-slate-600 dark:text-slate-300 rounded-xl shadow-sm border-slate-200 dark:border-slate-800">
                 <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[300px] p-0 bg-slate-50 dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800">
              <div className="p-6 h-full flex flex-col gap-6">
                <Button onClick={createNewChat} className="w-full h-12 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-900/40 rounded-xl text-slate-900 dark:text-slate-100 text-[10px] font-black uppercase tracking-widest gap-2 shadow-sm">
                  <Plus className="h-4 w-4 text-cyan-600" /> Nova Consulta
                </Button>
                <ScrollArea className="flex-1">
                   <div className="space-y-1">
                    {conversations.map((conv) => (
                      <div key={conv.id} onClick={() => router.push(`/knowledge/chat/${conv.id}`)}
                        className={cn("p-4 rounded-xl cursor-pointer", chatId === conv.id ? "bg-white dark:bg-slate-950 shadow-sm border border-slate-200 dark:border-slate-800" : "hover:bg-slate-100 dark:hover:bg-slate-900/40")}>
                        <p className={cn("text-[11px] font-black uppercase", chatId === conv.id ? "text-cyan-600 dark:text-cyan-400" : "text-slate-600 dark:text-slate-400")}>{conv.title}</p>
                      </div>
                    ))}
                   </div>
                </ScrollArea>
                <div className="pt-4 border-t border-slate-200 dark:border-slate-800">
                  <Button 
                    variant="ghost" 
                    onClick={() => { setMessages([]); localStorage.removeItem(`chat-history-${chatId}`); }}
                    className="w-full h-10 text-slate-400 dark:text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-xl text-[9px] font-black uppercase tracking-widest gap-2 transition-all"
                  >
                    <Trash2 className="h-4 w-4" /> Limpar Conversa
                  </Button>
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>

        {/* Chat Area - Centered & Premium */}
        <ScrollArea className="flex-1">
          <div className="max-w-4xl mx-auto px-6 py-10 space-y-10">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center py-20 text-center space-y-6">
                <div className="relative">
                  <div className="absolute inset-0 bg-cyan-400/20 blur-2xl rounded-full animate-pulse" />
                  <div className="w-20 h-20 bg-white dark:bg-slate-900 rounded-[2.5rem] flex items-center justify-center text-slate-900 dark:text-slate-100 shadow-xl relative z-10 border border-slate-100 dark:border-slate-800">
                    <Bot className="h-10 w-10 text-cyan-600" />
                  </div>
                </div>
                <div className="space-y-2">
                  <h3 className="text-3xl font-black uppercase tracking-tighter italic text-slate-900 dark:text-slate-100">O que vamos descobrir hoje?</h3>
                  <p className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-400 dark:text-slate-500">Motor de Agilidade • Espaço Ágil</p>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 w-full max-w-2xl mt-10">
                   {[
                     "Quais os processos de deploy?",
                     "Como funciona o Scrum Poker?",
                     "Quais as regras da Governança?",
                     "Explique o motor Jolt."
                   ].map(suggestion => (
                     <button 
                       key={suggestion}
                       onClick={() => { setInput(suggestion); }}
                       className="p-4 bg-slate-50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-800 rounded-2xl text-[11px] font-bold text-slate-600 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-900 hover:border-slate-900 dark:hover:border-slate-700 hover:text-slate-900 dark:hover:text-slate-100 transition-all text-left shadow-sm"
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
                  "flex gap-4 w-full group",
                  m.role === 'user' ? "flex-row-reverse" : "flex-row"
                )}
              >
                <div className={cn(
                  "w-10 h-10 rounded-2xl shrink-0 flex items-center justify-center shadow-sm border transition-transform group-hover:scale-110",
                  m.role === 'user' ? "bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400" : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100"
                )}>
                  {m.role === 'user' ? <User className="h-5 w-5" /> : <Bot className="h-5 w-5 text-cyan-600" />}
                </div>
                
                <div className={cn(
                  "flex flex-col gap-2 max-w-[80%]",
                  m.role === 'user' ? "items-end" : "items-start"
                )}>
                  <div className={cn(
                    "relative px-6 py-5 rounded-3xl text-[14px] leading-relaxed",
                    m.role === 'user' 
                      ? "bg-slate-100 dark:bg-slate-900 text-slate-800 dark:text-slate-200 rounded-tr-xl" 
                      : "bg-white dark:bg-slate-900/40 border border-slate-100 dark:border-slate-800 text-slate-800 dark:text-slate-200 rounded-tl-xl shadow-sm"
                  )}>
                    <div className="whitespace-pre-wrap break-words font-medium">{m.content}</div>
                    
                    {/* Documents & Results Rendering */}
                    {(m.docs || m.tdnResults) && (
                      <div className="mt-6 space-y-4 pt-6 border-t border-slate-100 dark:border-slate-800">
                        {m.docs && m.docs.length > 0 && (
                          <div className="space-y-3">
                            <div className="flex items-center gap-2">
                               <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                               <span className="text-[9px] font-black uppercase tracking-widest text-indigo-500">Documentação Local</span>
                            </div>
                            <div className="grid gap-2">
                              {m.docs.map((docItem) => (
                                <div 
                                  key={docItem.id}
                                  onClick={() => window.open(`/knowledge/kb?id=${docItem.id}`, '_blank')}
                                  className="bg-slate-50/50 dark:bg-slate-900/30 border border-slate-100 dark:border-slate-800 p-4 rounded-2xl hover:bg-white dark:hover:bg-slate-900 hover:border-indigo-500 hover:shadow-lg transition-all cursor-pointer group/card flex items-center justify-between"
                                >
                                  <div className="min-w-0">
                                    <h4 className="text-xs font-black uppercase text-slate-900 dark:text-slate-100 group-hover/card:text-indigo-600">{docItem.title}</h4>
                                    <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 line-clamp-1">{docItem.category || 'Wiki'}</p>
                                  </div>
                                  <ChevronRight className="h-4 w-4 text-slate-300 group-hover/card:text-indigo-500 group-hover/card:translate-x-1 transition-all" />
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {m.tdnResults && m.tdnResults.length > 0 && (
                          <div className="space-y-3">
                            <div className="flex items-center gap-2">
                               <div className="w-1.5 h-1.5 rounded-full bg-cyan-500" />
                               <span className="text-[9px] font-black uppercase tracking-widest text-cyan-500">TOTVS TDN Knowledge</span>
                            </div>
                            <div className="grid gap-2">
                              {m.tdnResults.map((tdn) => (
                                <div 
                                  key={tdn.id}
                                  className="bg-slate-50/50 dark:bg-slate-900/30 border border-slate-100 dark:border-slate-800 p-4 rounded-2xl flex items-center justify-between group/tdn"
                                >
                                  <div 
                                    className="flex-1 cursor-pointer"
                                    onClick={() => window.open(tdn.link, '_blank')}
                                  >
                                    <h4 className="text-xs font-black uppercase text-slate-900 dark:text-slate-100 group-hover/tdn:text-cyan-600">{tdn.title}</h4>
                                    <div className="flex items-center gap-2 mt-1">
                                      <span className="text-[9px] font-black text-slate-400 uppercase">{tdn.space}</span>
                                      <div className="w-1 h-1 rounded-full bg-slate-200 dark:bg-slate-800" />
                                      <span className="text-[9px] font-medium text-slate-400 italic">Fonte Externa</span>
                                    </div>
                                  </div>
                                  <Button 
                                    size="icon" 
                                    variant="ghost" 
                                    className="h-9 w-9 rounded-xl hover:bg-white dark:hover:bg-slate-900 text-slate-400 hover:text-cyan-600 shadow-sm border border-transparent hover:border-slate-200 dark:hover:border-slate-800"
                                    onClick={() => handleImport(tdn)}
                                    disabled={isImporting === tdn.id}
                                  >
                                    {isImporting === tdn.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                                  </Button>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* AI Key Warning */}
                    {m.role === 'assistant' && (m.docs || m.tdnResults) && !userApiKey && (
                       <div className="mt-6 p-5 rounded-2xl bg-rose-50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/30 space-y-3">
                          <div className="flex items-center gap-2">
                            <AlertCircle className="h-4 w-4 text-rose-600 dark:text-rose-400" />
                            <span className="text-[10px] font-black uppercase tracking-widest text-rose-600 dark:text-rose-400">Busca Simples Ativa</span>
                          </div>
                          <p className="text-[11px] text-rose-900/60 dark:text-rose-300/60 font-medium leading-relaxed">Sua chave de acesso ao motor não foi detectada. Estou operando no modo de busca indexada. Para análise avançada, configure sua chave.</p>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={() => router.push('/knowledge/settings')} 
                            className="h-9 rounded-xl text-[10px] font-black uppercase tracking-widest bg-white dark:bg-slate-900 border-rose-200 dark:border-rose-900 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-950/30 transition-all"
                          >
                             <Settings className="h-3.5 w-3.5 mr-2" /> Configurar Chave
                          </Button>
                       </div>
                    )}

                    {/* Quick Copy Button */}
                    <button 
                      onClick={() => { navigator.clipboard.writeText(m.content); toast({ title: "Copiado!" }); }}
                      className="absolute -left-10 top-2 p-2 opacity-0 group-hover:opacity-100 text-slate-300 dark:text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 transition-all"
                    >
                      <Copy className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="flex gap-6 animate-pulse">
                <div className="w-10 h-10 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800" />
                <div className="space-y-3 flex-1 max-w-md">
                  <div className="h-4 bg-slate-100 dark:bg-slate-900 rounded-lg w-full" />
                  <div className="h-4 bg-slate-100 dark:bg-slate-900 rounded-lg w-5/6" />
                </div>
              </div>
            )}
            
            {/* Âncora para scroll automático */}
            <div ref={messagesEndRef} className="h-1" />
          </div>
        </ScrollArea>

        {/* Input Experience - Docked at Bottom */}
        <div className="p-4 md:p-6 bg-white/80 dark:bg-slate-950/80 backdrop-blur-xl border-t border-slate-100 dark:border-slate-800 shrink-0 relative z-20">
          <div className="max-w-4xl mx-auto w-full">
            <form onSubmit={onFormSubmit} className="relative group">
              <div className="absolute inset-0 bg-slate-100/50 dark:bg-slate-900/20 rounded-[2.5rem] opacity-0 group-focus-within:opacity-100 transition-opacity" />
              <div className="relative flex items-center bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 rounded-[2.5rem] p-1.5 pl-3 focus-within:border-slate-900 dark:focus-within:border-slate-100 focus-within:shadow-lg transition-all">
                <Button 
                  type="button" 
                  variant="ghost" 
                  size="icon" 
                  className="h-10 w-10 rounded-full text-slate-400 dark:text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800 shrink-0"
                >
                  <Paperclip className="h-4 w-4" />
                </Button>
                <input 
                  value={input} 
                  onChange={(e) => setInput(e.target.value)} 
                  placeholder="Pergunte qualquer coisa sobre a Espaço Ágil..." 
                  className="flex-1 border-none focus:outline-none text-[13px] font-bold h-12 bg-transparent px-3 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500" 
                />
                <Button 
                  type="submit" 
                  disabled={isLoading || !input.trim()} 
                  className="h-10 w-10 bg-slate-900 dark:bg-slate-100 hover:bg-black dark:hover:bg-slate-200 text-white dark:text-slate-900 rounded-full flex items-center justify-center p-0 transition-all disabled:opacity-30 active:scale-95 shrink-0"
                >
                  {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </Button>
              </div>
            </form>
            <p className="text-center text-[8px] font-black uppercase tracking-[0.4em] text-slate-400 dark:text-slate-500 mt-3">
              Assistente de Agilidade • V4.0.2 Premium
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
    <Suspense fallback={<div className="h-full flex items-center justify-center font-black text-[10px] uppercase tracking-widest text-slate-500">Carregando Base de Conhecimento...</div>}>
      <ChatContent chatId={chatId} />
    </Suspense>
  );
}

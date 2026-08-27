"use client";

import React from 'react';
import {
  Trash2,
  RotateCcw,
  Trash,
  History,
  FileText,
  Database,
  Clock,
  ArrowLeft,
  ShieldAlert,
  Search
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useAuth } from '@/context/AuthContext';
import { knowledgeApi } from '@/app/knowledge/api';
import type { KnowledgeDocument } from '@/lib/knowledge-types';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { AgileSpinner } from '@/components/ui/AgileSpinner';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Input } from '@/components/ui/input';

export default function TrashPage() {
  const { session } = useAuth();
  const router = useRouter();
  const [searchTerm, setSearchTerm] = React.useState("");
  const [trashDocs, setTrashDocs] = React.useState<KnowledgeDocument[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);

  const formatDocDate = (dateVal: any) => {
    if (!dateVal) return '---';
    try {
      const date = new Date(dateVal);
      if (isNaN(date.getTime())) return '---';
      return formatDistanceToNow(date, { locale: ptBR, addSuffix: true });
    } catch (e) {
      return '---';
    }
  };

  const fetchTrash = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await knowledgeApi.listDocuments(undefined, undefined, 0, 100, 'deleted');
      setTrashDocs(res.content || []);
    } catch (error) {
      toast.error("Erro ao carregar a lixeira.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchTrash();
  }, [fetchTrash]);

  const filteredTrash = trashDocs.filter(d =>
    d.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleRestore = async (docItem: KnowledgeDocument) => {
    try {
      // O endpoint PUT substitui o documento inteiro (não é um PATCH parcial),
      // então reenviamos o registro completo só com o status alterado —
      // mandar apenas { status } apagaria título/conteúdo/tags no backend.
      await knowledgeApi.updateDocument(docItem.id, {
        ...docItem,
        status: 'published',
        updatedBy: session?.id,
      });
      setTrashDocs(prev => prev.filter(d => d.id !== docItem.id));
      toast.success("Documento restaurado com sucesso!");
    } catch (error) {
      toast.error("Erro ao restaurar.");
    }
  };

  // ATENÇÃO — gap de backend: o endpoint DELETE /api/knowledge/{id} faz apenas
  // soft-delete (seta status="deleted"). Não existe endpoint de hard-delete.
  // Chamá-lo novamente aqui num documento que já está com status="deleted" não
  // teria efeito real (nenhuma exclusão definitiva ocorre), então o botão fica
  // desabilitado até que um endpoint de exclusão definitiva seja definido no
  // backend, em vez de fingir uma ação que não acontece de verdade.
  const handlePermanentDelete = (id: string) => {
    toast.info("Exclusão permanente ainda não é suportada pelo backend — apenas a exclusão reversível (lixeira) está disponível no momento.");
  };

  return (
    <div className="px-4 md:px-10 lg:px-16 pt-4 lg:pt-6 pb-12 max-w-[1600px] mx-auto animate-in fade-in duration-700 bg-transparent min-h-full relative overflow-hidden">
       {/* Glow ambient background effects matching KB/Admin page */}
       <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-rose-100 dark:bg-rose-950/20 rounded-full blur-[120px] pointer-events-none -z-10" />

       <div className="space-y-6 md:space-y-8 relative z-10">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-slate-100 dark:border-slate-800 pb-6">
             <div className="space-y-3">
                <Button
                 variant="ghost"
                 onClick={() => router.back()}
                 className="gap-2 text-slate-500 dark:text-slate-400 hover:text-slate-950 dark:hover:text-slate-100 -ml-4 text-xs font-bold uppercase tracking-wider"
                >
                   <ArrowLeft className="h-4 w-4" /> Voltar ao Painel
                </Button>
                <div className="flex items-center gap-4">
                   <div className="w-12 h-12 bg-rose-50 dark:bg-rose-950/40 border border-rose-100 dark:border-rose-900/30 rounded-2xl flex items-center justify-center shadow-md">
                      <History className="h-6 w-6 text-rose-500" />
                   </div>
                   <div>
                      <h1 className="text-3xl font-black font-headline uppercase tracking-tighter italic text-slate-900 dark:text-slate-100 leading-none">
                         Cofre de <span className="text-rose-500 not-italic">Descarte</span>
                      </h1>
                      <p className="text-[9px] font-black text-rose-500 uppercase tracking-widest mt-1.5">
                         Retenção de 30 dias para ativos removidos
                      </p>
                   </div>
                </div>
             </div>

             <div className="relative w-full md:w-80">
                 <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 dark:text-slate-500 group-focus-within:text-rose-500 transition-colors" />
                 <Input
                   placeholder="Localizar na lixeira..."
                   className="pl-12 w-full h-11 rounded-xl bg-white/60 dark:bg-slate-900/60 border-slate-200 dark:border-slate-800 shadow-xs font-bold text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus-visible:ring-rose-500 transition-all"
                   value={searchTerm}
                   onChange={(e) => setSearchTerm(e.target.value)}
                 />
             </div>
          </div>

          {isLoading ? (
            <div className="py-40 flex flex-col items-center justify-center gap-4">
               <AgileSpinner variant="indigo" size="md" />
               <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 animate-pulse">Varrendo arquivos temporários...</span>
            </div>
          ) : filteredTrash.length === 0 ? (
            <div className="py-32 text-center space-y-4 bg-white/40 dark:bg-slate-900/40 border border-slate-200/60 dark:border-slate-800/80 rounded-[2.5rem] backdrop-blur-md">
               <div className="w-20 h-20 bg-slate-100 dark:bg-slate-950 rounded-[2rem] flex items-center justify-center mx-auto border border-slate-200 dark:border-slate-800">
                  <Trash className="h-8 w-8 text-slate-300 dark:text-slate-700" />
               </div>
               <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">A lixeira está vazia</p>
            </div>
          ) : (
             <div className="grid gap-4">
                {filteredTrash.map((docItem) => (
                  <div key={docItem.id} className="group p-5 bg-white/60 dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800/80 rounded-[2rem] flex items-center justify-between hover:border-rose-500/30 hover:bg-slate-50/50 dark:hover:bg-slate-900/80 transition-all duration-500 backdrop-blur-xs">
                     <div className="flex items-center gap-4 min-w-0">
                        <div className="w-11 h-11 bg-slate-100 dark:bg-slate-950 border border-slate-200/50 dark:border-white/5 rounded-xl flex items-center justify-center text-slate-400 dark:text-slate-500 group-hover:text-rose-500 group-hover:scale-105 transition-all duration-350 shrink-0">
                           <FileText className="h-5 w-5" />
                        </div>
                        <div className="min-w-0">
                           <h3 className="text-sm font-black uppercase italic tracking-tight text-slate-900 dark:text-slate-100 leading-none truncate pr-4">{docItem.title}</h3>
                           <div className="flex items-center gap-3 mt-2 flex-wrap">
                              <span className="text-[8px] font-black uppercase px-2 py-0.5 bg-slate-100 dark:bg-white/5 rounded text-slate-500 dark:text-slate-400 tracking-widest border border-slate-200/60 dark:border-white/5">{docItem.category}</span>
                              <span className="text-[8px] font-black uppercase text-slate-400 dark:text-slate-500 flex items-center gap-1">
                                 <Clock className="h-3 w-3" /> Excluído {formatDocDate(docItem.deletedAt)}
                              </span>
                           </div>
                        </div>
                     </div>

                     <div className="flex items-center gap-3 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                         <Button
                           variant="outline"
                           onClick={() => handleRestore(docItem)}
                           className="h-9 px-4 rounded-xl border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-slate-700 dark:text-slate-300 font-black uppercase text-[8px] tracking-wider gap-1.5 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 hover:text-emerald-600 dark:hover:text-emerald-400 hover:border-emerald-200 dark:hover:border-emerald-500/20 shadow-none transition-all"
                         >
                            <RotateCcw className="h-3.5 w-3.5" /> Restaurar
                         </Button>
                         <Button
                           variant="ghost"
                           onClick={() => handlePermanentDelete(docItem.id)}
                           title="Exclusão permanente ainda não suportada pelo backend"
                           className="h-9 w-9 rounded-xl text-slate-300 dark:text-slate-700 hover:text-rose-600 dark:hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 shadow-none transition-all cursor-not-allowed"
                         >
                            <Trash2 className="h-4 w-4" />
                         </Button>
                     </div>
                  </div>
                ))}
             </div>
          )}

          {/* Security Notice */}
          <div className="p-8 bg-rose-50/40 dark:bg-slate-900/40 border border-rose-100/50 dark:border-slate-800/80 rounded-[2.5rem] space-y-3 relative overflow-hidden backdrop-blur-md">
             <div className="absolute top-0 right-0 p-8 opacity-[0.02] pointer-events-none">
                <ShieldAlert className="h-32 w-32 text-rose-500" />
             </div>
             <h4 className="text-sm font-black uppercase italic tracking-tighter text-rose-600 dark:text-rose-500 leading-none">Aviso Estrutural</h4>
             <p className="text-[10px] font-bold text-slate-600 dark:text-slate-400 max-w-4xl leading-relaxed uppercase tracking-wider">
                Documentos em estado de descarte são mantidos por 30 dias antes da purga automática.
                A restauração recupera todos os metadados técnicos originais.
             </p>
          </div>
       </div>
    </div>
  );
}

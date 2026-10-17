"use client";

import React from 'react';
import {
  Trash2,
  RotateCcw,
  Trash,
  History,
  FileText,
  Clock,
  ArrowLeft,
  Info,
  Search
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/AuthContext';
import { knowledgeApi } from '@/app/knowledge/api';
import type { KnowledgeDocument } from '@/lib/knowledge-types';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { AgileSpinner } from '@/components/ui/AgileSpinner';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Input } from '@/components/ui/input';

const FOCUS = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background';

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
    } catch (error: any) {
      toast.error(error?.message || "Erro ao restaurar.");
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
    <div className="mx-auto min-h-full w-full max-w-[1200px] px-4 pb-12 pt-6 md:px-8 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300">
      <div className="space-y-6">
        {/* Cabeçalho */}
        <div className="flex flex-col justify-between gap-6 border-b border-border pb-6 md:flex-row md:items-end">
          <div className="space-y-3">
            <Button
              variant="ghost"
              onClick={() => router.back()}
              className={`-ml-3 gap-2 text-sm text-muted-foreground hover:text-foreground ${FOCUS}`}
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Voltar ao Painel
            </Button>
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-border bg-muted">
                <History className="h-6 w-6 text-foreground" aria-hidden="true" />
              </div>
              <div>
                <h1 className="text-3xl font-bold leading-tight tracking-tight text-foreground">Lixeira</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  Documentos removidos ficam aqui até serem restaurados.
                </p>
              </div>
            </div>
          </div>

          <div className="relative w-full md:w-80">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input
              aria-label="Localizar na lixeira"
              placeholder="Localizar na lixeira..."
              className="h-11 w-full rounded-xl border-border bg-card pl-10 text-sm text-foreground placeholder:text-muted-foreground"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {isLoading ? (
          <div role="status" className="flex flex-col items-center justify-center gap-4 py-32">
            <AgileSpinner variant="indigo" size="md" />
            <span className="text-sm text-muted-foreground">Carregando a lixeira...</span>
          </div>
        ) : filteredTrash.length === 0 ? (
          <div className="space-y-4 rounded-2xl border border-border bg-card py-24 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-border bg-muted">
              <Trash className="h-7 w-7 text-muted-foreground" aria-hidden="true" />
            </div>
            <p className="text-base font-semibold text-foreground">A lixeira está vazia</p>
          </div>
        ) : (
          <ul className="grid gap-3">
            {filteredTrash.map((docItem) => (
              <li
                key={docItem.id}
                className="flex flex-col justify-between gap-4 rounded-xl border border-border bg-card p-4 motion-safe:transition-colors hover:bg-muted/40 sm:flex-row sm:items-center"
              >
                <div className="flex min-w-0 items-center gap-4">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-border bg-muted text-muted-foreground">
                    <FileText className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="truncate pr-4 text-base font-semibold text-foreground">{docItem.title}</h3>
                    <div className="mt-1.5 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                      <span className="rounded-md border border-border bg-muted px-2 py-0.5 text-[0.8125rem] font-medium text-foreground">{docItem.category}</span>
                      <span className="flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5" aria-hidden="true" /> Excluído {formatDocDate(docItem.deletedAt)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  {docItem.canEdit && (
                    <Button
                      variant="outline"
                      onClick={() => handleRestore(docItem)}
                      aria-label={`Restaurar ${docItem.title}`}
                      className={`h-9 gap-1.5 rounded-[10px] px-4 text-sm font-semibold ${FOCUS}`}
                    >
                      <RotateCcw className="h-4 w-4" aria-hidden="true" /> Restaurar
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-disabled="true"
                    aria-label={`Excluir ${docItem.title} permanentemente (indisponível)`}
                    onClick={() => handlePermanentDelete(docItem.id)}
                    title="A exclusão permanente ainda não está disponível"
                    className={`h-9 w-9 cursor-not-allowed rounded-[10px] text-muted-foreground opacity-70 hover:bg-muted hover:text-muted-foreground ${FOCUS}`}
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}

        {/* Aviso */}
        <div role="note" className="flex gap-3 rounded-xl border border-amber-500/35 bg-amber-500/10 p-4 text-foreground md:p-5">
          <Info className="mt-0.5 h-5 w-5 shrink-0 text-amber-700 dark:text-amber-400" aria-hidden="true" />
          <div className="space-y-1">
            <h2 className="text-base font-semibold text-foreground">Sobre a lixeira</h2>
            <p className="max-w-4xl text-sm leading-relaxed text-foreground">
              Itens na lixeira ficam guardados para restauração. A exclusão permanente ainda não está disponível.
              Quem pode restaurar: o autor, a liderança da squad ou administradores. A restauração recupera todos os metadados originais.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

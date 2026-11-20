"use client";

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, Clock, FileText, Search } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Modal, ModalButton } from '@/components/room-kit';
import { Input } from '@/components/ui/input';
import { AgileSpinner } from '@/components/ui/AgileSpinner';
import { useAuth } from '@/context/AuthContext';
import { knowledgeApi } from '@/app/knowledge/api';
import type { KnowledgeDocument } from '@/lib/knowledge-types';

const SEARCH_DEBOUNCE_MS = 300;

export function GlobalSearch({ open, onOpenChange }: { open: boolean, onOpenChange: (open: boolean) => void }) {
  const router = useRouter();
  const { session } = useAuth();
  const [search, setSearch] = useState("");
  const [documents, setDocuments] = useState<KnowledgeDocument[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Busca via API REST (Spring Boot / PostgreSQL) em vez de assinatura realtime
  // do Firestore. Sem termo, traz os documentos mais recentes; com termo,
  // dispara a busca no backend após um pequeno debounce (evita 1 request por tecla).
  useEffect(() => {
    if (!open || !session) return;

    let cancelled = false;
    setIsLoading(true);

    const trimmed = search.trim();
    const handle = setTimeout(async () => {
      try {
        const response = await knowledgeApi.listDocuments(trimmed || undefined, undefined, 0, 100);
        if (!cancelled) setDocuments(response.content);
      } catch (error) {
        console.error('Erro ao buscar na base de conhecimento:', error);
        if (!cancelled) setDocuments([]);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }, trimmed === "" ? 0 : SEARCH_DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [open, session, search]);

  // O Modal leva o foco para a própria janela; aqui a pessoa quer digitar.
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => inputRef.current?.focus(), 60);
    return () => clearTimeout(t);
  }, [open]);

  const filteredResults = useMemo(() => {
    return search.trim() === "" ? documents.slice(0, 5) : documents;
  }, [documents, search]);

  const handleSelect = (doc: KnowledgeDocument) => {
    onOpenChange(false);
    router.push(`/knowledge/kb?id=${doc.id}`);
  };

  const formatDocDate = (updatedAt: unknown) => {
    if (!updatedAt) return '---';
    try {
      const date = new Date(updatedAt as string | number | Date);
      if (isNaN(date.getTime())) return '---';
      return formatDistanceToNow(date, { locale: ptBR, addSuffix: true });
    } catch {
      return '---';
    }
  };

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        onOpenChange(true);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, [onOpenChange]);

  const hasTerm = search.trim() !== "";

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      size="lg"
      icon={Search}
      title="Pesquisar na base"
      description="Procure por título, categoria ou caminho do documento."
      headerExtra={
        <div className="px-6 pb-4">
          <label htmlFor="kb-global-search" className="sr-only">Pesquisar na base de conhecimento</label>
          <div className="relative">
            <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" strokeWidth={1.5} />
            <Input
              id="kb-global-search"
              ref={inputRef}
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="O que você quer encontrar?"
              autoComplete="off"
              className="h-11 pl-9 text-base sm:text-sm"
            />
          </div>
        </div>
      }
      bodyClassName="min-h-[14rem] px-3 pb-4 sm:px-4"
    >
      {isLoading ? (
        <div className="flex flex-col items-center justify-center gap-4 py-16" role="status">
          <AgileSpinner variant="indigo" size="lg" />
          <p className="text-sm text-muted-foreground">Consultando a base de conhecimento…</p>
        </div>
      ) : filteredResults.length > 0 ? (
        <div className="flex flex-col gap-1">
          <p className="px-2 pb-2 text-xs font-semibold text-muted-foreground">
            {hasTerm ? `${filteredResults.length} ${filteredResults.length === 1 ? 'resultado' : 'resultados'} para “${search.trim()}”` : 'Atualizados recentemente'}
          </p>
          {filteredResults.map((doc) => (
            <button
              key={doc.id}
              type="button"
              onClick={() => handleSelect(doc)}
              className="group flex w-full items-center gap-3 rounded-xl border border-transparent p-3 text-left transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground group-hover:text-foreground">
                <FileText className="h-5 w-5" strokeWidth={1.5} />
              </span>
              <span className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="flex min-w-0 items-center gap-2">
                  <span className="truncate text-sm font-semibold text-foreground" title={doc.title}>{doc.title}</span>
                  {doc.category && (
                    <span className="shrink-0 rounded-md border border-border bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">{doc.category}</span>
                  )}
                </span>
                <span className="truncate text-xs text-muted-foreground" title={doc.fullPath || undefined}>{doc.fullPath || 'Geral'}</span>
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground tabular-nums">
                  <Clock aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={1.5} /> {formatDocDate(doc.updatedAt)}
                </span>
              </span>
              <ArrowRight aria-hidden="true" className="h-4 w-4 shrink-0 text-muted-foreground group-hover:text-foreground" strokeWidth={1.5} />
            </button>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center gap-3 py-12 text-center">
          <p className="text-base font-semibold text-foreground">Nada encontrado</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            {hasTerm ? <>Nenhum documento corresponde a <span className="font-semibold text-foreground">“{search.trim()}”</span>.</> : 'A base ainda não tem documentos.'}
          </p>
          {hasTerm && <ModalButton onClick={() => setSearch("")}>Limpar busca</ModalButton>}
        </div>
      )}
    </Modal>
  );
}

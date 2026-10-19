'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Camera, ExternalLink, FileText, X, ZoomIn } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { TaskFile } from './types';
import { useTaskFileBlob } from './useTaskFileBlob';

interface TaskFileEvidenceProps {
  sessionId: string;
  file: TaskFile;
  title: string;
  isLight?: boolean;
}

/** Evidência do Modo Teatro vinda de arquivo anexado ao card: imagem (ampliável) ou PDF embutido. */
export function TaskFileEvidence({ sessionId, file, title, isLight }: TaskFileEvidenceProps) {
  const { status, url } = useTaskFileBlob(sessionId, file);
  const [expanded, setExpanded] = useState(false);
  const isPdf = file.contentType === 'application/pdf';

  if (status !== 'ready' || !url) {
    return (
      <motion.div
        key={`file-wait-${file.id}`}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="text-center space-y-6"
      >
        <div className={cn(
          "w-40 h-40 rounded-[4rem] border flex items-center justify-center mx-auto",
          status === 'loading' && 'animate-pulse',
          isLight ? "bg-muted border-border text-muted-foreground" : "bg-foreground/5 border-border text-muted-foreground"
        )}>
          <Camera className="h-16 w-16" />
        </div>
        <p className={cn("text-xs font-bold tracking-[0.3em]", "text-muted-foreground")}>
          {status === 'error' ? `Não foi possível abrir ${file.name}` : 'Carregando evidência...'}
        </p>
      </motion.div>
    );
  }

  if (isPdf) {
    return (
      <motion.div
        key={`file-pdf-${file.id}`}
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 1.1 }}
        transition={{ duration: 0.7, ease: [0.23, 1, 0.32, 1] }}
        className={cn(
          "w-full h-full max-w-6xl rounded-[3.5rem] overflow-hidden border relative",
          isLight ? "bg-card border-border shadow-[0_30px_90px_rgba(0,0,0,0.08)]" : "bg-background border-border shadow-[0_50px_150px_rgba(0,0,0,0.8)]"
        )}
      >
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          title="Abrir PDF em nova aba"
          className={cn(
            "absolute top-6 left-10 z-20 flex items-center gap-2 px-3 py-1.5 backdrop-blur-md rounded-full border transition-colors",
            isLight ? "bg-card/80 hover:bg-card text-foreground border-border shadow-md" : "bg-foreground/10 hover:bg-foreground/20 border-border text-muted-foreground hover:text-foreground"
          )}
        >
          <ExternalLink className="h-3.5 w-3.5" />
          <span className="text-xs font-bold">Nova aba</span>
        </a>
        <div className="absolute top-6 right-10 z-20 flex items-center gap-2 px-3 py-1.5 bg-background/50 backdrop-blur-md rounded-full border border-border pointer-events-none max-w-[40%]">
          <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <span className="text-xs font-bold text-muted-foreground truncate">{file.name}</span>
        </div>
        <iframe src={url} title={`Evidência da Tarefa: ${title}`} className="w-full h-full border-none bg-[#00202F]" />
      </motion.div>
    );
  }

  return (
    <>
      <motion.div
        key={`file-img-${file.id}`}
        initial={{ opacity: 0, scale: 0.9, rotateY: 10 }}
        animate={{ opacity: 1, scale: 1, rotateY: 0 }}
        exit={{ opacity: 0, scale: 1.1 }}
        transition={{ duration: 0.7, ease: [0.23, 1, 0.32, 1] }}
        className={cn(
          "w-full h-full max-w-6xl rounded-[3.5rem] overflow-hidden border flex items-center justify-center group cursor-zoom-in relative",
          isLight ? "bg-[#fff] border-border shadow-[0_50px_150px_rgba(0,0,0,0.1)]" : "bg-[#00202F] border-border shadow-[0_50px_150px_rgba(0,0,0,0.8)]"
        )}
        onClick={() => setExpanded(true)}
        title="Clique para ampliar"
      >
        <img src={url} alt={`Evidência visual: ${title} (${file.name})`} className="max-w-full max-h-full object-contain" />
        <div className="absolute bottom-6 right-8 z-20 flex items-center gap-2 px-3 py-1.5 bg-foreground/10 backdrop-blur-md rounded-full border border-border text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
          <ZoomIn className="h-3.5 w-3.5" />
          <span className="text-xs font-bold">Ampliar</span>
        </div>
      </motion.div>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-background/95 flex items-center justify-center p-8 cursor-zoom-out"
            onClick={() => setExpanded(false)}
          >
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setExpanded(false)}
              className="absolute top-6 right-8 h-10 w-10 rounded-xl bg-foreground/10 text-foreground hover:bg-foreground/20"
            >
              <X className="h-4 w-4" />
            </Button>
            <img
              src={url}
              alt={`Evidência visual ampliada: ${title}`}
              className="max-w-full max-h-full object-contain"
              onClick={e => e.stopPropagation()}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

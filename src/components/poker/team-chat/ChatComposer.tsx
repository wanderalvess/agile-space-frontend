'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Code2, Send } from 'lucide-react';
import { cn } from '@/lib/utils';
import { FIELD } from '@/components/room-kit';
import { MAX_MESSAGE_LENGTH, type ChatMessageKind } from './chatChannels';

export function ChatComposer({
  placeholder,
  onSend,
  onTyping,
  typingLabel = null,
}: {
  placeholder: string;
  onSend: (text: string, kind: ChatMessageKind) => void;
  /** Avisa que a pessoa está digitando (a Retro usa para o "escrevendo…"; o Poker não passa). */
  onTyping?: () => void;
  /** "Fulana está escrevendo…" neste canal. */
  typingLabel?: string | null;
}) {
  const [text, setText] = useState('');
  const [isCodeMode, setIsCodeMode] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, isCodeMode ? 220 : 120)}px`;
  }, [text, isCodeMode]);

  const canSend = text.trim().length > 0 && text.length <= MAX_MESSAGE_LENGTH;

  const send = () => {
    if (!canSend) return;
    onSend(isCodeMode ? text.replace(/\s+$/, '') : text.trim(), isCodeMode ? 'code' : 'text');
    setText('');
    setIsCodeMode(false);
    textareaRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== 'Enter' || e.nativeEvent.isComposing) return;
    const wantsSend = isCodeMode ? (e.ctrlKey || e.metaKey) : !e.shiftKey;
    if (wantsSend) {
      e.preventDefault();
      send();
    }
  };

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); send(); }}
      className="flex flex-col gap-1.5 border-t border-border p-3"
    >
      <div className="flex items-end gap-2">
        <button
          type="button"
          onClick={() => { setIsCodeMode(v => !v); textareaRef.current?.focus(); }}
          className={cn(
            'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border transition-colors duration-fast focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            isCodeMode ? 'border-primary/60 bg-primary/10 text-primary [.theme-totvs:not(.dark)_&]:text-foreground' : 'border-border text-muted-foreground hover:bg-accent'
          )}
          title={isCodeMode ? 'Sair do modo código' : 'Enviar trecho de código'}
          aria-label={isCodeMode ? 'Sair do modo código' : 'Enviar trecho de código'}
          aria-pressed={isCodeMode}
        >
          <Code2 className="h-4 w-4" strokeWidth={1.5} />
        </button>
        <label htmlFor="chat-input" className="sr-only">Mensagem</label>
        <textarea
          id="chat-input"
          ref={textareaRef}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            if (e.target.value.trim()) onTyping?.();
          }}
          onKeyDown={handleKeyDown}
          rows={1}
          maxLength={MAX_MESSAGE_LENGTH}
          spellCheck={!isCodeMode}
          placeholder={isCodeMode ? 'Cole o trecho de código…' : placeholder}
          className={cn(FIELD, 'min-h-10 min-w-0 flex-1 resize-none py-2.5 text-sm', isCodeMode && 'overflow-x-auto whitespace-pre font-mono text-xs')}
        />
        <button
          type="submit"
          disabled={!canSend}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground room-glow transition-[opacity,background-color] duration-fast hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-50 disabled:shadow-none"
          aria-label="Enviar mensagem"
        >
          <Send className="h-4 w-4" strokeWidth={1.5} />
        </button>
      </div>
      {typingLabel && <p role="status" className="m-0 px-1 text-xs text-muted-foreground motion-safe:animate-pulse">{typingLabel}</p>}
      <p className="m-0 px-1 text-xs text-muted-foreground">
        {isCodeMode ? 'Ctrl+Enter envia · Enter quebra linha' : 'Enter envia · Shift+Enter quebra linha · ``` para código'}
      </p>
    </form>
  );
}

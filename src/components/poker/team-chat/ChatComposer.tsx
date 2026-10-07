'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Code2, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { MAX_MESSAGE_LENGTH, type ChatMessageKind } from './chatChannels';

export function ChatComposer({
  placeholder,
  onSend,
}: {
  placeholder: string;
  onSend: (text: string, kind: ChatMessageKind) => void;
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
    <div className="p-3 bg-slate-50/80 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800">
      <div className={cn(
        'flex items-end gap-2 rounded-2xl border bg-white dark:bg-slate-900 p-1.5 transition-colors',
        isCodeMode ? 'border-indigo-300 dark:border-indigo-700' : 'border-slate-200 dark:border-slate-700'
      )}>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => { setIsCodeMode(v => !v); textareaRef.current?.focus(); }}
          className={cn(
            'h-9 w-9 shrink-0 rounded-xl',
            isCodeMode ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400' : 'text-slate-400'
          )}
          title={isCodeMode ? 'Sair do modo código' : 'Enviar trecho de código'}
          aria-pressed={isCodeMode}
        >
          <Code2 className="h-4 w-4" />
        </Button>
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={1}
          maxLength={MAX_MESSAGE_LENGTH}
          spellCheck={!isCodeMode}
          placeholder={isCodeMode ? 'Cole o trecho de código…' : placeholder}
          className={cn(
            'flex-1 min-w-0 resize-none bg-transparent py-2 text-[12px] text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none',
            isCodeMode && 'font-mono text-[11px] whitespace-pre overflow-x-auto'
          )}
        />
        <Button
          type="button"
          size="icon"
          disabled={!canSend}
          onClick={send}
          className="h-9 w-9 shrink-0 rounded-xl bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-600/20 active:scale-90"
          aria-label="Enviar mensagem"
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
      <p className="mt-1.5 px-1 text-[9px] font-bold uppercase tracking-widest text-slate-400">
        {isCodeMode ? 'Ctrl+Enter envia · Enter quebra linha' : 'Enter envia · Shift+Enter quebra linha · ``` para código'}
      </p>
    </div>
  );
}

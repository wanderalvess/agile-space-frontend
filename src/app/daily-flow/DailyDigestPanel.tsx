'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Sparkles, Loader2, Save, Trash2, AlertTriangle, Link as LinkIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { squadApi } from '@/app/squad/api';
import type { SquadMember } from '@/lib/types';
import { dailyFlowApi, type DailyCheckinData } from '@/app/daily-flow/api';
import type { DailyDigestEntry, DailyDigestActionItem } from '@/lib/dailyDigestExtract';

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function slug(name: string): string {
  return name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-');
}

interface Props {
  squadId: string;
}

export function DailyDigestPanel({ squadId }: Props) {
  const { toast } = useToast();
  const [rawText, setRawText] = useState('');
  const [date, setDate] = useState(todayIso());
  const [useAi, setUseAi] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [source, setSource] = useState<'ai' | 'rules' | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [entries, setEntries] = useState<DailyDigestEntry[]>([]);
  const [actionItems, setActionItems] = useState<DailyDigestActionItem[]>([]);
  const [members, setMembers] = useState<SquadMember[]>([]);

  useEffect(() => {
    if (!squadId) return;
    squadApi.getMembers(squadId).then(setMembers).catch(() => setMembers([]));
  }, [squadId]);

  const matchMember = useMemo(() => {
    return (name: string): SquadMember | undefined => {
      const normalized = name.trim().toLowerCase();
      return members.find((m) => m.displayName?.trim().toLowerCase() === normalized)
        || members.find((m) => m.displayName?.trim().toLowerCase().includes(normalized) || normalized.includes(m.displayName?.trim().toLowerCase() ?? '\0'));
    };
  }, [members]);

  const handleExtract = async () => {
    if (!rawText.trim()) {
      toast({ title: 'Cole a nota da daily primeiro', variant: 'destructive' });
      return;
    }
    setIsExtracting(true);
    setWarning(null);
    try {
      const result = await dailyFlowApi.extractDigest(rawText, useAi);
      setEntries(result.entries);
      setActionItems(result.actionItems);
      setSource(result.source);
      if (result.warning) setWarning(result.warning);
      if (result.entries.length === 0 && result.actionItems.length === 0) {
        toast({ title: 'Nada reconhecido na nota', description: 'Tente colar um texto com nomes ("Fulano: ...") ou uma seção de itens de ação.' });
      }
    } catch (err) {
      console.error(err);
      toast({ title: 'Erro ao extrair o resumo', variant: 'destructive' });
    } finally {
      setIsExtracting(false);
    }
  };

  const updateEntry = (index: number, patch: Partial<DailyDigestEntry>) => {
    setEntries((prev) => prev.map((e, i) => (i === index ? { ...e, ...patch } : e)));
  };

  const removeEntry = (index: number) => {
    setEntries((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    if (entries.length === 0) {
      toast({ title: 'Nada para salvar', description: 'Extraia o resumo primeiro.', variant: 'destructive' });
      return;
    }
    setIsSaving(true);
    try {
      const payload: DailyCheckinData[] = entries.map((entry) => {
        const member = matchMember(entry.name);
        const userId = member?.claimedByUid || member?.jiraAccountId || `unmatched:${slug(entry.name)}`;
        return {
          userId,
          userName: member?.displayName || entry.name,
          squadId,
          date,
          today: entry.today,
          blockers: entry.blockers,
          hasBlocker: entry.hasBlocker,
        };
      });
      await dailyFlowApi.saveCheckinsBatch(payload);
      toast({ title: 'Daily digest salvo', description: `${payload.length} registro(s) para ${date}.` });
    } catch (err) {
      console.error(err);
      toast({ title: 'Erro ao salvar', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="p-6 rounded-3xl space-y-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <Label className="text-[11px] font-black uppercase tracking-widest text-slate-400">
            Cole a nota da daily (ex: a que o Google Meet já gera)
          </Label>
          <div className="flex items-center gap-4">
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-40 h-9 rounded-xl"
            />
            <div className="flex items-center gap-2">
              <Switch id="use-ai" checked={useAi} onCheckedChange={setUseAi} />
              <Label htmlFor="use-ai" className="text-xs font-bold text-slate-500">
                Usar IA (se configurada)
              </Label>
            </div>
          </div>
        </div>
        <Textarea
          value={rawText}
          onChange={(e) => setRawText(e.target.value)}
          placeholder={'Ex:\nMaria: terminei o PROJ-101, hoje começo o PROJ-105\nJoão: travado esperando acesso ao ambiente de homolog\n\nItens de ação\n- Pedir acesso de homolog pro João (PROJ-105)'}
          className="min-h-[220px] rounded-2xl font-mono text-sm"
        />
        <div className="flex justify-end">
          <Button onClick={handleExtract} disabled={isExtracting} className="rounded-2xl gap-2 font-black uppercase tracking-widest text-xs">
            {isExtracting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            Gerar resumo
          </Button>
        </div>
      </Card>

      {(entries.length > 0 || actionItems.length > 0) && (
        <>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant={source === 'ai' ? 'default' : 'secondary'}>
              {source === 'ai' ? 'Gerado por IA' : 'Extraído por regra (sem IA)'}
            </Badge>
            {warning && (
              <span className="text-xs text-amber-600 flex items-center gap-1">
                <AlertTriangle className="h-3.5 w-3.5" /> {warning}
              </span>
            )}
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {entries.map((entry, i) => (
              <Card key={`${entry.name}-${i}`} className="p-5 rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <Input
                    value={entry.name}
                    onChange={(e) => updateEntry(i, { name: e.target.value })}
                    className="font-black text-sm border-none px-0 h-auto focus-visible:ring-0"
                  />
                  <Button variant="ghost" size="icon" onClick={() => removeEntry(i)}>
                    <Trash2 className="h-4 w-4 text-slate-400" />
                  </Button>
                </div>
                <div>
                  <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Hoje / andamento</Label>
                  <Textarea
                    value={entry.today}
                    onChange={(e) => updateEntry(i, { today: e.target.value })}
                    className="mt-1 min-h-[60px] rounded-xl text-sm"
                  />
                </div>
                <div>
                  <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Bloqueios</Label>
                  <Textarea
                    value={entry.blockers}
                    onChange={(e) => updateEntry(i, { blockers: e.target.value, hasBlocker: !!e.target.value })}
                    className="mt-1 min-h-[50px] rounded-xl text-sm"
                    placeholder="Sem bloqueio"
                  />
                </div>
                {!matchMember(entry.name) && (
                  <p className="text-[11px] text-amber-600">Não encontrei "{entry.name}" no squad — vai salvar como não-vinculado.</p>
                )}
              </Card>
            ))}
          </div>

          {actionItems.length > 0 && (
            <Card className="p-5 rounded-2xl space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Action items detectados</Label>
              <ul className="space-y-2">
                {actionItems.map((item, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm">
                    <span className="flex-1">{item.text}</span>
                    {item.jiraKey && (
                      <Badge variant="outline" className="gap-1">
                        <LinkIcon className="h-3 w-3" /> {item.jiraKey}
                      </Badge>
                    )}
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={isSaving} className="rounded-2xl gap-2 font-black uppercase tracking-widest text-xs">
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Salvar daily de {date}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

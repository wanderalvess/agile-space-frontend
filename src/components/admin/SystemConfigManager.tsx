'use client';

import { useCallback, useEffect, useId, useState } from 'react';
import { AlertCircle, Building2, CheckCircle2, Loader2, RotateCcw, Save } from 'lucide-react';
import { toast } from 'sonner';
import { adminApi } from '@/app/admin/api';
import { useAuth } from '@/context/AuthContext';
import { logSystemEvent } from '@/lib/audit';
import { PAGE_CARD, ErrorState } from '@/components/page';
import { IconTile, ModalButton } from '@/components/room-kit';
import { ConfirmDialog } from '@/components/room-kit/ConfirmDialog';
import { FIELD } from '@/components/room-kit/tokens';
import { cn } from '@/lib/utils';
import {
  DEFAULT_SYSTEM_CONFIG,
  changedConfigKeys,
  failedKeysLabel,
  formFromServer,
  hslCss,
  tabTitleFor,
  validateConfig,
  type SystemConfigForm,
  type SystemConfigKey,
} from './system-config';

type Phase = 'loading' | 'error' | 'ready';
type SaveState = 'idle' | 'saving' | 'saved' | 'error';

export function SystemConfigManager() {
  const { session } = useAuth();
  const nameId = useId();
  const colorId = useId();
  const [phase, setPhase] = useState<Phase>('loading');
  const [saved, setSaved] = useState<SystemConfigForm>(DEFAULT_SYSTEM_CONFIG);
  const [form, setForm] = useState<SystemConfigForm>(DEFAULT_SYSTEM_CONFIG);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [failed, setFailed] = useState<SystemConfigKey[]>([]);
  const [confirmRestore, setConfirmRestore] = useState(false);

  const load = useCallback(async () => {
    setPhase('loading');
    try {
      const [companyName, primaryColor] = await Promise.all([adminApi.getConfig('companyName'), adminApi.getConfig('primaryColor')]);
      const loaded = formFromServer({ companyName, primaryColor });
      setSaved(loaded);
      setForm(loaded);
      setPhase('ready');
    } catch (e) {
      // Antes a tela abria com os valores padrão como se fossem os salvos.
      console.error('Erro ao carregar configurações:', e);
      setPhase('error');
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial da aba
    void load();
  }, [load]);

  const errors = validateConfig(form);
  const valid = !errors.companyName && !errors.primaryColor;
  const color = hslCss(form.primaryColor);

  const edit = (patch: Partial<SystemConfigForm>) => {
    setForm((f) => ({ ...f, ...patch }));
    if (saveState !== 'saving') setSaveState('idle');
  };

  const save = async () => {
    if (!valid || saveState === 'saving') return;
    const next: SystemConfigForm = { companyName: form.companyName.trim(), primaryColor: form.primaryColor.trim().replace(/\s+/g, ' ') };
    const keys = changedConfigKeys(saved, next);
    setSaveState('saving');
    const results = await Promise.allSettled(
      keys.map((k) => (k === 'primaryColor' && next.primaryColor === '' ? adminApi.clearConfig(k) : adminApi.setConfig(k, next[k]))),
    );
    const failedKeys = keys.filter((_, i) => results[i].status === 'rejected');
    const okKeys = keys.filter((_, i) => results[i].status === 'fulfilled');
    // O que foi gravado passa a ser o "salvo"; o que falhou continua diferente e pode ser tentado de novo.
    setSaved((s) => ({ ...s, ...Object.fromEntries(okKeys.map((k) => [k, next[k]])) }));
    setForm(next);

    if (failedKeys.length > 0) {
      setFailed(failedKeys);
      setSaveState('error');
      toast.error('Erro ao salvar', { description: `Não foi possível gravar: ${failedKeysLabel(failedKeys)}.` });
      return;
    }
    setFailed([]);
    setSaveState('saved');
    toast.success('Configurações salvas', { description: 'Vale para todos no próximo carregamento da página' });
    if (keys.length > 0) {
      void logSystemEvent({
        content: `Configurações do sistema alteradas: ${failedKeysLabel(keys)}.`,
        type: 'admin',
        severity: 'warning',
        userEmail: session?.email,
        module: 'SystemConfig',
      });
    }
  };

  const restore = () => {
    setForm(DEFAULT_SYSTEM_CONFIG);
    setSaveState('idle');
    setConfirmRestore(false);
  };

  return (
    <div className="flex flex-col gap-4">
      <section className="flex flex-col gap-1">
        <h2 className="text-[22px] font-bold text-foreground">Configurações do sistema</h2>
        <p className="text-sm text-muted-foreground">Vale para todas as pessoas que usam o portal</p>
      </section>

      {phase === 'loading' && (
        <div role="status" aria-busy="true" className="flex h-64 flex-col items-center justify-center gap-3 text-sm font-semibold text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin text-primary motion-reduce:animate-none [.theme-totvs:not(.dark)_&]:text-foreground" strokeWidth={1.5} aria-hidden="true" />
          Carregando preferências do sistema...
        </div>
      )}

      {phase === 'error' && (
        <ErrorState
          title="Não foi possível carregar as configurações"
          description="Os valores salvos não puderam ser lidos. Nada foi alterado."
          onRetry={() => void load()}
          className="max-w-[760px]"
        />
      )}

      {phase === 'ready' && (
        <div className="grid max-w-[1100px] grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,1fr)_330px]">
          <div className="flex min-w-0 flex-col gap-3.5">
            {saveState === 'saved' && (
              <div role="status" className="flex flex-wrap items-center gap-3 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-3.5 py-3 text-sm">
                <CheckCircle2 className="h-[18px] w-[18px] shrink-0 text-emerald-700 dark:text-emerald-300" strokeWidth={1.5} aria-hidden="true" />
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="font-bold text-foreground">Configurações salvas</span>
                  <span className="text-muted-foreground">Vale para todos no próximo carregamento da página</span>
                </span>
                <ModalButton className="h-[34px] px-3 text-[13px]" onClick={() => window.location.reload()}>
                  Recarregar agora
                </ModalButton>
              </div>
            )}

            {saveState === 'error' && (
              <div role="alert" className="flex items-start gap-3 rounded-xl border border-red-500/40 bg-red-500/10 px-3.5 py-3 text-sm">
                <AlertCircle className="mt-0.5 h-[18px] w-[18px] shrink-0 text-red-700 dark:text-red-300" strokeWidth={1.5} aria-hidden="true" />
                <span className="flex flex-col gap-0.5">
                  <span className="font-bold text-foreground">Erro ao salvar</span>
                  <span className="text-muted-foreground">
                    Uma ou mais configurações não foram salvas{failed.length > 0 ? ` (${failedKeysLabel(failed)})` : ''}. Confira os campos e tente de novo.
                  </span>
                </span>
              </div>
            )}

            <section className={cn(PAGE_CARD, 'flex flex-col gap-5 p-5 sm:p-6')} aria-labelledby={`${nameId}-title`}>
              <span className="flex items-center gap-3">
                <IconTile icon={Building2} size="lg" />
                <h3 id={`${nameId}-title`} className="text-lg font-bold text-foreground">
                  Personalização
                </h3>
              </span>

              <div className="flex flex-col gap-1.5">
                <label htmlFor={nameId} className="text-[13px] font-semibold text-foreground">
                  Nome da empresa / instância
                </label>
                <input
                  id={nameId}
                  value={form.companyName}
                  onChange={(e) => edit({ companyName: e.target.value })}
                  aria-invalid={!!errors.companyName}
                  placeholder="Ex.: Acme Tecnologia"
                  className={cn(FIELD, 'h-10 font-semibold', errors.companyName && 'border-red-500/60')}
                />
                {errors.companyName ? (
                  <span role="alert" className="flex items-center gap-1.5 text-xs font-semibold text-red-700 dark:text-red-300">
                    <AlertCircle className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />
                    {errors.companyName}
                  </span>
                ) : (
                  <span className="text-xs text-muted-foreground">Aparece no título da aba do navegador</span>
                )}
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor={colorId} className="text-[13px] font-semibold text-foreground">
                  Cor primária (formato HSL)
                </label>
                <span className="flex items-center gap-3">
                  <input
                    id={colorId}
                    value={form.primaryColor}
                    onChange={(e) => edit({ primaryColor: e.target.value })}
                    aria-invalid={!!errors.primaryColor}
                    aria-describedby={`${colorId}-hint`}
                    placeholder="Cor do tema (ex.: 24 93% 53%)"
                    spellCheck={false}
                    className={cn(FIELD, 'h-10 font-mono', errors.primaryColor && 'border-red-500/60')}
                  />
                  <span
                    aria-hidden="true"
                    className={cn('h-11 w-11 shrink-0 rounded-xl border-2', color ? 'border-card ring-1 ring-border' : 'border-dashed border-border')}
                    style={color ? { backgroundColor: color } : undefined}
                  />
                </span>
                {errors.primaryColor && (
                  <span role="alert" className="flex items-center gap-1.5 text-xs font-semibold text-red-700 dark:text-red-300">
                    <AlertCircle className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />
                    {errors.primaryColor}
                  </span>
                )}
                <span id={`${colorId}-hint`} className="text-xs text-muted-foreground">
                  Matiz saturação% luminosidade%. Ex.: 220 70% 50% é azul. Vazio usa a cor do tema.
                </span>
                <span className="text-xs text-muted-foreground">Vale só no tema Espaço Clássico; os outros temas mantêm a própria cor</span>
              </div>

              <div className="flex flex-wrap items-center gap-2.5 pt-1">
                <ModalButton variant="primary" className="min-w-[150px] gap-2" disabled={!valid || saveState === 'saving'} onClick={() => void save()}>
                  {saveState === 'saving' ? (
                    <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" strokeWidth={1.5} aria-hidden="true" />
                  ) : (
                    <Save className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
                  )}
                  {saveState === 'saving' ? 'Salvando…' : 'Salvar'}
                </ModalButton>
                <ModalButton className="gap-2" disabled={saveState === 'saving'} onClick={() => setConfirmRestore(true)}>
                  <RotateCcw className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
                  Restaurar padrão
                </ModalButton>
              </div>
            </section>
          </div>

          <aside aria-label="Prévia" className={cn(PAGE_CARD, 'flex flex-col gap-3.5 p-5')}>
            <h3 className="text-sm font-bold text-foreground">Prévia</h3>
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-bold text-muted-foreground">Título da aba</span>
              <span className="flex h-[34px] items-center truncate rounded-t-[10px] border border-b-0 border-border bg-muted px-3 text-[13px] text-foreground">
                {tabTitleFor(form.companyName)}
              </span>
            </div>
            <div className="flex flex-col gap-2">
              <span className="text-xs font-bold text-muted-foreground">Cor primária</span>
              <span className="flex items-center gap-2.5">
                <span
                  className={cn(
                    'inline-flex h-9 items-center rounded-[10px] px-4 text-[13px] font-bold',
                    errors.primaryColor ? 'bg-border text-muted-foreground' : !color && 'bg-primary text-primary-foreground',
                  )}
                  style={color ? { backgroundColor: color, color: '#FFFFFF' } : undefined}
                >
                  Botão
                </span>
                <span
                  className={cn(
                    'inline-flex h-6 items-center rounded-full px-2.5 text-xs font-bold',
                    errors.primaryColor ? 'bg-muted text-muted-foreground' : !color && 'bg-primary/15 text-primary [.theme-totvs:not(.dark)_&]:text-foreground',
                  )}
                  style={color ? { backgroundColor: `hsl(${form.primaryColor.trim().replace(/\s+/g, ' ')} / 0.16)`, color } : undefined}
                >
                  Destaque
                </span>
              </span>
            </div>
            <p className="text-xs leading-relaxed text-muted-foreground">Com outro nome, a aba mostra Nome | Gestão Ágil</p>
          </aside>
        </div>
      )}

      <ConfirmDialog
        open={confirmRestore}
        onOpenChange={setConfirmRestore}
        tone="brand"
        icon={RotateCcw}
        title="Restaurar o padrão?"
        description="O nome volta a Portal Tech V&D e a cor volta à do tema. Só vale depois de Salvar."
        cancelLabel="Manter"
        confirmLabel="Restaurar padrão"
        keepOpenOnConfirm
        onConfirm={restore}
      />
    </div>
  );
}

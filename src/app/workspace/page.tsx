'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Loader2, Search, UserRound } from 'lucide-react';
import { EmptyState, LoadingSkeleton, PageHeader, PageShell } from '@/components/page';
import { StatusChip, TabBar } from '@/components/room-kit';
import { useAuth } from '@/context/AuthContext';
import { useUserContext } from '@/context/UserContext';

import { CalmariaButton } from '@/components/workspace/CalmariaButton';
import { CommandPalette } from '@/components/workspace/CommandPalette';
import { ConnectivitySettings } from '@/components/workspace/ConnectivitySettings';
import { HistoryTimeline } from '@/components/workspace/HistoryTimeline';
import { KanbanBoard } from '@/components/workspace/KanbanBoard';
import { MyPrompts } from '@/components/workspace/MyPrompts';
import { ProfileSettings } from '@/components/workspace/ProfileSettings';
import { QuickLinks, type QuickLinkInput } from '@/components/workspace/QuickLinks';
import { SnippetLibrary } from '@/components/workspace/SnippetLibrary';
import { StickyNotes } from '@/components/workspace/StickyNotes';
import { TaskDialog } from '@/components/workspace/TaskDialog';
import { WorkspaceHome } from '@/components/workspace/WorkspaceHome';
import { SubTabs } from '@/components/workspace/workspace-ui';
import { useWorkspaceData } from '@/components/workspace/useWorkspaceData';
import { useToast } from '@/hooks/use-toast';
import type { KanbanCardData, KanbanStatus } from '@/components/workspace/types';
import {
  ACCOUNT_LABELS,
  ACCOUNT_SUBS,
  LIBRARY_LABELS,
  LIBRARY_SUBS,
  TAB_LABELS,
  WORKSPACE_TABS,
  parseWorkspaceLocation,
  workspaceHref,
  type WorkspaceLocation,
  type WorkspaceTab,
} from '@/components/workspace/workspace-nav';

/** Pedido de uma ação que depende de uma aba que ainda vai montar (paleta de comandos). */
type Intent = 'new-snippet' | 'new-link' | 'focus-note-search' | null;

function WorkspaceView() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { session } = useAuth();
  const { toast } = useToast();
  const { userProfile, updateProfile, requestIdentity, isInitializing } = useUserContext();

  // O servidor só aceita o próprio id do login na rota; ele vem primeiro.
  const effectiveUserId = session?.id || userProfile?.id || userProfile?.email || '';
  const currentSquadId = session?.activeProjectId || userProfile?.squadId;

  const location = useMemo(() => parseWorkspaceLocation(searchParams), [searchParams]);
  const data = useWorkspaceData(effectiveUserId, currentSquadId);

  // Diálogo de tarefa
  const [taskOpen, setTaskOpen] = useState(false);
  const [editingCard, setEditingCard] = useState<KanbanCardData | null>(null);
  const [newTaskStatus, setNewTaskStatus] = useState<KanbanStatus>('todo');
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [intent, setIntent] = useState<Intent>(null);
  const clearIntent = useCallback(() => setIntent(null), []);

  useEffect(() => {
    if (!isInitializing && !userProfile && !session) requestIdentity();
  }, [userProfile, session, isInitializing, requestIdentity]);

  const go = useCallback(
    (loc: WorkspaceLocation) => {
      router.push(`${pathname}${workspaceHref(loc).replace('/workspace', '')}`, { scroll: false });
    },
    [router, pathname],
  );

  const openTask = useCallback((status: KanbanStatus = 'todo', card: KanbanCardData | null = null) => {
    setEditingCard(card);
    setNewTaskStatus(card?.status ?? status);
    setTaskOpen(true);
  }, []);

  const todoCount = data.cards.filter((c) => c.status === 'todo').length;
  const tabItems = WORKSPACE_TABS.map((id) => ({
    id,
    label: TAB_LABELS[id],
    count: id === 'kanban' ? todoCount : id === 'notas' ? data.notes.length : id === 'biblioteca' ? data.links.length : id === 'historico' ? data.history?.length ?? 0 : undefined,
  }));

  const handleUpdateProfile = (changes: Parameters<typeof updateProfile>[0]) => {
    data.markSaving();
    updateProfile(changes);
    toast({ title: 'Perfil atualizado!', description: 'Suas permissões foram validadas.' });
  };

  const handleSaveLink = (link: QuickLinkInput) =>
    data.saveLink({
      ...(link.id ? { id: link.id, createdAt: link.createdAt } : {}),
      title: link.name,
      url: link.url,
      iconType: link.iconType,
      color: link.color,
    });

  if (isInitializing) {
    return (
      <PageShell documentTitle="Meu espaço" feedbackName="Meu espaço">
        <LoadingSkeleton variant="cards" rows={3} label="Carregando dados do seu Espaço." />
      </PageShell>
    );
  }

  if (!userProfile && !session) {
    return (
      <PageShell documentTitle="Meu espaço" feedbackName="Meu espaço">
        <EmptyState icon={UserRound} title="Autenticação requerida" description="Por favor, conecte-se para acessar o seu Espaço Privado." />
      </PageShell>
    );
  }

  const aba: WorkspaceTab = location.aba;

  return (
    <PageShell documentTitle="Meu espaço" feedbackName="Meu espaço">
      <PageHeader
        title="Meu espaço"
        module="workspace"
        badges={
          data.isSaving ? (
            <StatusChip tone="brand" dot>
              <span role="status" className="inline-flex items-center gap-1.5">
                <Loader2 className="h-3 w-3 animate-spin motion-reduce:animate-none" strokeWidth={1.5} aria-hidden="true" /> Salvando…
              </span>
            </StatusChip>
          ) : undefined
        }
        actions={
          <>
            <CalmariaButton />
            <button
              type="button"
              onClick={() => setPaletteOpen(true)}
              aria-label="Busca e comandos"
              className="inline-flex h-10 items-center gap-2.5 rounded-[10px] border border-border bg-muted/40 px-3 text-[13px] font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Search className="h-[15px] w-[15px]" strokeWidth={1.5} aria-hidden="true" />
              Busca
              <kbd className="hidden rounded-md border border-border px-1.5 py-px font-code text-xs font-medium sm:inline">⌘K</kbd>
            </button>
          </>
        }
      />

      <TabBar
        tabs={tabItems}
        value={aba}
        onChange={(id) => go({ aba: id })}
        label="Seções do Meu espaço"
        idPrefix="workspace"
        className="overflow-x-auto px-0"
        tabClassName="whitespace-nowrap max-sm:h-11"
      />

      <div role="tabpanel" id={`workspace-panel-${aba}`} aria-labelledby={`workspace-tab-${aba}`} tabIndex={-1} className="flex min-w-0 flex-col gap-4 outline-none">
        {aba === 'inicio' &&
          (data.isLoading && !data.loadError ? (
            <LoadingSkeleton variant="cards" rows={3} label="Carregando dados do seu Espaço." />
          ) : (
            <WorkspaceHome
              tasks={data.cards}
              history={data.history}
              notes={data.notes}
              userProfile={userProfile}
              onNavigate={go}
              onAddTask={() => openTask('todo')}
              onAddNote={data.addNote}
              loadError={data.loadError}
              onRetry={data.reload}
            />
          ))}

        {aba === 'kanban' && (
          <KanbanBoard
            cards={data.cards}
            isLoading={data.isLoading}
            loadError={data.loadError}
            onRetry={data.reload}
            onUpdateStatus={data.moveCard}
            onEditCard={(card) => openTask(card.status, card)}
            onAddTask={(status) => openTask(status)}
          />
        )}

        {aba === 'notas' && (
          <StickyNotes
            notes={data.notes}
            isLoading={data.isLoading}
            loadError={data.loadError}
            onRetry={data.reload}
            onAdd={data.addNote}
            onUpdate={data.updateNote}
            onDelete={data.deleteNote}
            onConvertToTask={data.promoteNote}
            focusSearch={intent === 'focus-note-search'}
            onFocusHandled={clearIntent}
          />
        )}

        {aba === 'biblioteca' && (
          <>
            <SubTabs
              label="Biblioteca"
              idPrefix="workspace-biblioteca"
              value={location.sub as (typeof LIBRARY_SUBS)[number]}
              onChange={(sub) => go({ aba: 'biblioteca', sub })}
              items={LIBRARY_SUBS.map((id) => ({ id, label: LIBRARY_LABELS[id], count: id === 'atalhos' ? data.links.length : undefined }))}
            />
            <div role="tabpanel" id="workspace-biblioteca-panel" aria-labelledby={`workspace-biblioteca-tab-${location.sub}`} className="flex min-w-0 flex-col outline-none">
              {location.sub === 'atalhos' && (
                <QuickLinks
                  links={data.links.map((l) => ({ id: l.id as string, name: l.title, url: l.url, iconType: l.iconType || 'link', color: l.color || '', createdAt: l.createdAt }))}
                  loadError={data.loadError}
                  onRetry={data.reload}
                  onSaveLink={handleSaveLink}
                  onDeleteLink={data.deleteLink}
                  openNew={intent === 'new-link'}
                  onOpenNewHandled={clearIntent}
                />
              )}
              {location.sub === 'prompts' && <MyPrompts userProfile={userProfile} />}
              {location.sub === 'snippets' && <SnippetLibrary openNew={intent === 'new-snippet'} onOpenNewHandled={clearIntent} />}
            </div>
          </>
        )}

        {aba === 'historico' && (
          <HistoryTimeline items={data.history} isLoading={data.isLoadingHistory} error={data.historyError} onRetry={data.retryHistory} userId={effectiveUserId} />
        )}

        {aba === 'conta' && (
          <>
            <SubTabs
              label="Conta"
              idPrefix="workspace-conta"
              value={location.sub as (typeof ACCOUNT_SUBS)[number]}
              onChange={(sub) => go({ aba: 'conta', sub })}
              items={ACCOUNT_SUBS.map((id) => ({ id, label: ACCOUNT_LABELS[id] }))}
            />
            <div role="tabpanel" id="workspace-conta-panel" aria-labelledby={`workspace-conta-tab-${location.sub}`} className="flex min-w-0 flex-col outline-none">
              {location.sub === 'perfil' && <ProfileSettings profile={userProfile} onUpdate={handleUpdateProfile} />}
              {location.sub === 'conectividade' && <ConnectivitySettings />}
            </div>
          </>
        )}
      </div>

      <TaskDialog
        open={taskOpen}
        onOpenChange={setTaskOpen}
        card={editingCard}
        initialStatus={newTaskStatus}
        onCreate={data.createCard}
        onPatch={data.patchCard}
        onDelete={data.deleteCard}
      />

      <CommandPalette
        open={paletteOpen}
        onOpenChange={setPaletteOpen}
        onNavigate={go}
        onAddTask={() => openTask('todo')}
        onAddNote={() => {
          go({ aba: 'notas' });
          data.addNote();
        }}
        onAddSnippet={() => {
          setIntent('new-snippet');
          go({ aba: 'biblioteca', sub: 'snippets' });
        }}
        onAddLink={() => {
          setIntent('new-link');
          go({ aba: 'biblioteca', sub: 'atalhos' });
        }}
        onSearchNotes={() => {
          setIntent('focus-note-search');
          go({ aba: 'notas' });
        }}
        tasks={data.cards}
        notes={data.notes}
        onOpenTask={(card) => openTask(card.status, card)}
      />
    </PageShell>
  );
}

export default function WorkspacePage() {
  // useSearchParams precisa de Suspense para a página poder ser pré-renderizada.
  return (
    <Suspense
      fallback={
        <PageShell documentTitle="Meu espaço" feedbackName="Meu espaço">
          <LoadingSkeleton variant="cards" rows={3} label="Carregando dados do seu Espaço." />
        </PageShell>
      }
    >
      <WorkspaceView />
    </Suspense>
  );
}

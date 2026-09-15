'use client';

import React from 'react';
import {
  Copy,
  ExternalLink,
  GitFork,
  Edit3,
  Trash2,
  Star,
  Share2,
  Send,
  Calendar,
  Target,
  Users,
  FileText,
  MessageSquare,
  ArrowUpRight
} from 'lucide-react';
import { cn, openExternalUrl, toSafeExternalUrl } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PromptItem } from '../types';
import { getTypeMeta, getStatusMeta, getImpactMeta, getVisibilityMeta } from '../constants';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useAuth } from '@/context/AuthContext';
import { promptApi } from '../api';

interface PromptViewProps {
  prompt: PromptItem | null;
  isOpen: boolean;
  isOwner: boolean;
  isReadOnly?: boolean;
  onClose: () => void;
  /** Recebe o id do item para contabilizar o uso. */
  onCopy: (id: string) => void;
  onEdit?: (prompt: PromptItem) => void;
  onDelete?: (id: string) => void;
  onFork?: (prompt: PromptItem) => void;
  onToggleFavorite?: (id: string) => void;
  onSelectTag?: (tag: string) => void;
  userProfile?: any;
}

interface CommentItem {
  id: string;
  authorId: string;
  authorName: string;
  authorRole: string;
  authorSquad: string;
  authorAvatar?: string;
  content: string;
  createdAt: any;
}

function MetaRow({
  icon: Icon,
  label,
  children
}: {
  icon: React.ElementType;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-2.5 text-sm">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0">
        <span className="text-muted-foreground">{label}: </span>
        <span className="text-foreground">{children}</span>
      </div>
    </div>
  );
}

export function PromptView({
  prompt,
  isOpen,
  isOwner,
  isReadOnly = false,
  onClose,
  onCopy,
  onEdit,
  onDelete,
  onFork,
  onToggleFavorite,
  onSelectTag,
  userProfile
}: PromptViewProps) {
  const { session } = useAuth();

  const [variableValues, setVariableValues] = React.useState<Record<string, string>>({});
  const [comments, setComments] = React.useState<CommentItem[]>([]);
  const [newComment, setNewComment] = React.useState('');
  const [isPosting, setIsPosting] = React.useState(false);

  // Variáveis no formato {{nome}} viram campos preenchíveis antes de copiar.
  const variables = React.useMemo(() => {
    if (!prompt?.content) return [];
    const regex = /\{\{([^}]+)\}\}/g;
    const matches = new Set<string>();
    let match;
    while ((match = regex.exec(prompt.content)) !== null) {
      matches.add(match[1].trim());
    }
    return Array.from(matches);
  }, [prompt?.content]);

  const processedContent = React.useMemo(() => {
    if (!prompt?.content) return '';
    let text = prompt.content;
    Object.entries(variableValues).forEach(([key, val]) => {
      if (val) {
        const escapedKey = key.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
        const regex = new RegExp(`\\{\\{\\s*${escapedKey}\\s*\\}\\}`, 'g');
        text = text.replace(regex, val);
      }
    });
    return text;
  }, [prompt?.content, variableValues]);

  const fetchComments = React.useCallback(async () => {
    if (!prompt?.id || !isOpen || !session) {
      setComments([]);
      return;
    }
    try {
      const data = await promptApi.getComments(prompt.id);
      setComments(data as any[]);
    } catch (err: any) {
      console.warn('Discussão indisponível para este item:', err.message);
      setComments([]);
    }
  }, [prompt?.id, isOpen, session]);

  React.useEffect(() => {
    fetchComments();
  }, [fetchComments]);

  React.useEffect(() => {
    setVariableValues({});
    setNewComment('');
  }, [prompt?.id]);

  if (!prompt) return null;

  const type = getTypeMeta(prompt.type);
  const status = getStatusMeta(prompt.status);
  const impact = getImpactMeta(prompt.impact);
  const visibility = getVisibilityMeta(prompt.visibility);
  const TypeIcon = type.icon;
  const VisibilityIcon = visibility.icon;

  const hasContent = !!prompt.content?.trim();
  const safeToolLink = toSafeExternalUrl(prompt.gemLink);
  const safeDocLink = toSafeExternalUrl(prompt.architectureLink);
  const blockedToolLink = !!prompt.gemLink?.trim() && !safeToolLink;

  const formattedDate = prompt.updatedAt
    ? format(
        (prompt.updatedAt as any) instanceof Date
          ? (prompt.updatedAt as unknown as Date)
          : typeof prompt.updatedAt === 'string'
            ? new Date(prompt.updatedAt)
            : (prompt.updatedAt as any).toDate?.() || new Date(),
        "d 'de' MMMM 'de' yyyy",
        { locale: ptBR }
      )
    : null;

  const handleCopy = async () => {
    if (!hasContent) return;
    try {
      await navigator.clipboard.writeText(processedContent);
      onCopy(prompt.id);
      toast.success(
        variables.length > 0 ? 'Conteúdo copiado com suas variáveis' : 'Conteúdo copiado'
      );
    } catch (err) {
      console.error(err);
      toast.error('Não foi possível copiar o conteúdo.');
    }
  };

  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/prompt-hub/${prompt.id}`);
      toast.success('Link copiado');
    } catch (err) {
      console.error(err);
      toast.error('Não foi possível copiar o link.');
    }
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session || !newComment.trim() || !prompt?.id) return;

    setIsPosting(true);
    try {
      await promptApi.addComment(prompt.id, {
        authorId: session.id,
        authorName: userProfile?.name || session.name || 'Membro',
        authorRole: userProfile?.role || 'Engenheiro',
        authorSquad: userProfile?.squadId || 'Squad Geral',
        authorAvatar: userProfile?.avatarSeed || '',
        content: newComment.trim()
      });
      setNewComment('');
      fetchComments();
    } catch (err: any) {
      toast.error('Erro ao comentar', { description: err.message });
    } finally {
      setIsPosting(false);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    toast.error('Remoção de comentários não suportada no momento.');
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="flex max-h-[94vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-4xl lg:max-w-5xl xl:max-w-6xl 2xl:max-w-7xl">
        <DialogHeader className="space-y-3 border-b border-border px-6 py-4 text-left">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={cn(
                'inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium',
                type.chip
              )}
            >
              <TypeIcon className="h-3.5 w-3.5" />
              {type.label}
            </span>
            <span className={cn('rounded-md px-2 py-1 text-xs font-medium', status.chip)}>
              {status.label}
            </span>
            <span
              className="inline-flex items-center gap-1 text-xs text-muted-foreground"
              title={visibility.description}
            >
              <VisibilityIcon className="h-3.5 w-3.5" />
              {visibility.label}
            </span>
            <span className="text-xs text-muted-foreground">· {impact.label}</span>
          </div>

          <DialogTitle className="pr-8 text-xl font-semibold leading-tight">
            {prompt.title}
          </DialogTitle>

          {prompt.description?.trim() && (
            <p className="text-sm leading-relaxed text-muted-foreground">{prompt.description}</p>
          )}

          <div className="flex flex-wrap items-center gap-2 pt-1">
            {hasContent && (
              <Button onClick={handleCopy} size="sm" className="gap-2">
                <Copy className="h-4 w-4" />
                Copiar conteúdo
              </Button>
            )}

            {safeToolLink && (
              <Button
                variant={hasContent ? 'outline' : 'default'}
                size="sm"
                onClick={() => openExternalUrl(safeToolLink)}
                className="gap-2"
              >
                <ExternalLink className="h-4 w-4" />
                Abrir ferramenta
              </Button>
            )}

            {!isReadOnly && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onFork?.(prompt)}
                  className="gap-2"
                >
                  <GitFork className="h-4 w-4" />
                  Duplicar
                </Button>

                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => onToggleFavorite?.(prompt.id)}
                  title={prompt.isFavorited ? 'Remover dos favoritos' : 'Favoritar'}
                  className={cn('h-9 w-9', prompt.isFavorited && 'text-amber-500')}
                >
                  <Star className={cn('h-4 w-4', prompt.isFavorited && 'fill-current')} />
                </Button>
              </>
            )}

            <Button
              variant="outline"
              size="icon"
              onClick={handleShare}
              title="Copiar link"
              className="h-9 w-9"
            >
              <Share2 className="h-4 w-4" />
            </Button>

            {isOwner && !isReadOnly && (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onEdit?.(prompt)}
                  title="Editar"
                  className="h-9 w-9"
                >
                  <Edit3 className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onDelete?.(prompt.id)}
                  title="Excluir"
                  className="h-9 w-9 text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </>
            )}
          </div>

          {blockedToolLink && (
            <p className="text-xs text-destructive">
              O link cadastrado não é http(s) e por isso não será aberto.
            </p>
          )}
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          <div className="space-y-6 lg:space-y-0 lg:grid lg:grid-cols-12 lg:gap-8">
            {/* Coluna Esquerda: Variáveis preenchíveis + Pré-visualização do conteúdo / Prompt Specimen */}
            <div className="lg:col-span-7 xl:col-span-7 space-y-5">
              {variables.length > 0 && (
                <section className="space-y-3 rounded-xl border border-border bg-muted/40 p-4">
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">Personalize antes de copiar</h3>
                    <p className="text-xs text-muted-foreground">
                      Os valores preenchidos substituem as variáveis no conteúdo copiado.
                    </p>
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {variables.map(variable => (
                      <div key={variable} className="space-y-1.5">
                        <Label htmlFor={`var-${variable}`} className="text-xs font-medium">
                          {variable}
                        </Label>
                        <Input
                          id={`var-${variable}`}
                          value={variableValues[variable] || ''}
                          onChange={e =>
                            setVariableValues(prev => ({ ...prev, [variable]: e.target.value }))
                          }
                          placeholder={`Valor para ${variable}`}
                          className="h-9 text-sm"
                        />
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {hasContent && (
                <section className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-foreground">{type.contentLabel}</h3>
                    <span className="text-[11px] font-mono text-muted-foreground">
                      {processedContent.length} chars · {processedContent.split('\n').length} linhas
                    </span>
                  </div>
                  <pre className="max-h-[520px] min-h-[200px] overflow-auto whitespace-pre-wrap break-words rounded-xl border border-border bg-muted/30 p-4 font-code text-[13px] leading-relaxed text-foreground select-text">
                    {processedContent}
                  </pre>
                </section>
              )}
            </div>

            {/* Coluna Direita: Metadados técnicos, Tags e Discussão */}
            <div className="lg:col-span-5 xl:col-span-5 space-y-6 lg:border-l lg:border-border/60 lg:pl-6">
              {/* Metadados */}
              <section className="rounded-xl border border-border bg-muted/20 p-4 space-y-3">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Ficha Técnica
                </h3>
                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-1">
                  <MetaRow icon={Users} label="Autor">
                    {prompt.authorName || 'Membro'}
                    {prompt.authorSquad ? ` · ${prompt.authorSquad}` : ''}
                  </MetaRow>

                  {formattedDate && (
                    <MetaRow icon={Calendar} label="Atualizado em">
                      {formattedDate}
                    </MetaRow>
                  )}

                  <MetaRow icon={ArrowUpRight} label="Uso">
                    {prompt.useCount || 0} cópias · {prompt.forkCount || 0} clones
                  </MetaRow>

                  {prompt.targetAudience?.trim() && (
                    <MetaRow icon={Users} label="Público-alvo">
                      {prompt.targetAudience}
                    </MetaRow>
                  )}

                  {prompt.businessGoal?.trim() && (
                    <div className="sm:col-span-2 lg:col-span-1">
                      <MetaRow icon={Target} label="Objetivo de negócio">
                        {prompt.businessGoal}
                      </MetaRow>
                    </div>
                  )}

                  {safeDocLink && (
                    <div className="sm:col-span-2 lg:col-span-1">
                      <MetaRow icon={FileText} label="Documentação">
                        <button
                          onClick={() => openExternalUrl(safeDocLink)}
                          className="inline-flex items-center gap-1 text-primary underline-offset-4 hover:underline text-left break-all"
                        >
                          {safeDocLink}
                          <ExternalLink className="h-3 w-3 shrink-0" />
                        </button>
                      </MetaRow>
                    </div>
                  )}
                </div>
              </section>

              {/* Tags */}
              {prompt.tags && prompt.tags.length > 0 && (
                <section className="space-y-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Tags
                  </h3>
                  <div className="flex flex-wrap gap-1.5">
                    {prompt.tags.map(tag => (
                      <button
                        key={tag}
                        onClick={() => onSelectTag?.(tag)}
                        className="rounded-md bg-muted px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                        title="Filtrar a biblioteca por esta tag"
                      >
                        #{tag}
                      </button>
                    ))}
                  </div>
                </section>
              )}

              {/* Discussão */}
              <section className="space-y-3 pt-2">
                <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <MessageSquare className="h-4 w-4 text-muted-foreground" />
                  Discussão
                  {comments.length > 0 && (
                    <span className="text-xs font-normal text-muted-foreground">
                      ({comments.length})
                    </span>
                  )}
                </h3>

                {!session ? (
                  <p className="text-xs text-muted-foreground">Entre para participar da discussão.</p>
                ) : (
                  <>
                    <form onSubmit={handleAddComment} className="flex items-center gap-2">
                      <Input
                        value={newComment}
                        onChange={e => setNewComment(e.target.value)}
                        placeholder="Deixe uma dica de uso ou resultado..."
                        className="h-9 text-xs"
                      />
                      <Button
                        type="submit"
                        size="icon"
                        disabled={isPosting || !newComment.trim()}
                        className="h-9 w-9 shrink-0"
                        title="Enviar"
                      >
                        <Send className="h-3.5 w-3.5" />
                      </Button>
                    </form>

                    {comments.length === 0 ? (
                      <p className="text-xs text-muted-foreground">
                        Nenhum comentário ainda. Seja a primeira pessoa a contar como usou.
                      </p>
                    ) : (
                      <ul className="space-y-2.5 max-h-[280px] overflow-y-auto pr-1">
                        {comments.map(comment => (
                          <li key={comment.id} className="rounded-lg border border-border bg-muted/20 p-3">
                            <div className="mb-1 flex items-center justify-between gap-2">
                              <span className="text-xs font-semibold text-foreground">
                                {comment.authorName}
                                {comment.authorSquad ? (
                                  <span className="font-normal text-muted-foreground">
                                    {' '}
                                    · {comment.authorSquad}
                                  </span>
                                ) : null}
                              </span>
                              {comment.authorId === session.id && (
                                <button
                                  onClick={() => handleDeleteComment(comment.id)}
                                  className="text-muted-foreground hover:text-destructive"
                                  title="Excluir comentário"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              )}
                            </div>
                            <p className="whitespace-pre-wrap text-xs leading-relaxed text-foreground">
                              {comment.content}
                            </p>
                          </li>
                        ))}
                      </ul>
                    )}
                  </>
                )}
              </section>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

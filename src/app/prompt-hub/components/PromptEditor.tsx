'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  X,
  ChevronDown,
  Link as LinkIcon,
  Info,
  GraduationCap,
  CircleAlert,
  TriangleAlert,
  CircleCheck
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { PromptItem, PromptVisibility } from '../types';
import { TYPE_ORDER, TYPE_META, getTypeMeta, VISIBILITY_META } from '../constants';
import { cn, toSafeExternalUrl } from '@/lib/utils';
import { validateSkillFrontmatter } from '../skillFrontmatter';
import { findSimilarPrompts } from '../findSimilar';
import { toast } from 'sonner';

interface PromptEditorProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Partial<PromptItem>) => void;
  initialData?: PromptItem | null;
  /** Acervo visível, usado para avisar sobre itens parecidos antes de publicar. */
  existingItems?: PromptItem[];
}

const SIMILARITY_REASON_LABEL: Record<string, string> = {
  'titulo-identico': 'Mesmo título',
  'conteudo-identico': 'Mesmo conteúdo',
  'titulo-parecido': 'Título parecido'
};

const SUGGESTED_TAGS = [
  'refinamento',
  'code-review',
  'testes',
  'documentacao',
  'arquitetura',
  'daily',
  'produto',
  'qa'
];

const EMPTY_FORM: Partial<PromptItem> = {
  title: '',
  content: '',
  description: '',
  gemLink: '',
  type: 'prompt',
  visibility: 'private',
  tags: [],
  status: 'producao',
  impact: 'medio',
  businessGoal: '',
  targetAudience: '',
  architectureLink: ''
};

export function PromptEditor({
  isOpen,
  onClose,
  onSave,
  initialData,
  existingItems = []
}: PromptEditorProps) {
  const router = useRouter();
  const [formData, setFormData] = useState<Partial<PromptItem>>(EMPTY_FORM);
  const [tagInput, setTagInput] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);

  useEffect(() => {
    setFormData(initialData ? { ...initialData } : EMPTY_FORM);
    setTagInput('');
    // Detalhes adicionais só abrem sozinhos quando o item já usa algum deles.
    setShowAdvanced(
      !!initialData?.businessGoal ||
        !!initialData?.targetAudience ||
        !!initialData?.architectureLink
    );
  }, [initialData, isOpen]);

  const typeMeta = getTypeMeta(formData.type);
  const isSkill = formData.type === 'skill';

  // Só valida skill, e só depois que a pessoa começou a escrever — validar um
  // campo ainda vazio só serve para acusar erro antes da primeira tecla.
  const skillCheck = useMemo(() => {
    if (!isSkill || !formData.content?.trim()) return null;
    return validateSkillFrontmatter(formData.content);
  }, [isSkill, formData.content]);

  // Aviso de duplicata: nunca bloqueia. Variação proposital é legítima — quem
  // publica decide se é caso de criar outro item ou de editar o que já existe.
  const similarItems = useMemo(
    () => findSimilarPrompts(formData.title, formData.content, existingItems, initialData?.id),
    [formData.title, formData.content, existingItems, initialData?.id]
  );

  const update = (patch: Partial<PromptItem>) => setFormData(prev => ({ ...prev, ...patch }));

  const handleAddTag = (tag: string) => {
    const newTag = tag.trim().replace(/#/g, '').toLowerCase();
    if (newTag && !formData.tags?.includes(newTag)) {
      update({ tags: [...(formData.tags || []), newTag] });
    }
    setTagInput('');
  };

  const removeTag = (tagToRemove: string) =>
    update({ tags: formData.tags?.filter(t => t !== tagToRemove) });

  // Normaliza os links antes de gravar: assim o banco só guarda http(s) e o
  // leitor não recebe um esquema perigoso para abrir.
  const handleSubmit = () => {
    if (!formData.title?.trim()) {
      toast.error('Dê um título ao item', {
        description: 'É por ele que as pessoas vão encontrar o que você publicou.'
      });
      return;
    }

    const hasContent = !!formData.content?.trim();
    const hasLink = !!formData.gemLink?.trim();

    if (!hasContent && !hasLink) {
      toast.error('Falta o conteúdo', {
        description: typeMeta.linkFirst
          ? 'Informe o link da ferramenta ou descreva a configuração.'
          : `Preencha o campo "${typeMeta.contentLabel}".`
      });
      return;
    }

    // Skill fora do formato não é publicada: um SKILL.md inválido nunca é
    // carregado pelo agente, então publicar seria distribuir algo quebrado.
    if (isSkill && skillCheck && skillCheck.errors.length > 0) {
      toast.error('O SKILL.md ainda não está no formato', {
        description: skillCheck.errors[0]
      });
      return;
    }

    const linkFields: Array<[keyof PromptItem, string]> = [
      ['gemLink', 'Link da ferramenta'],
      ['architectureLink', 'Link de documentação']
    ];

    const normalized: Partial<PromptItem> = { ...formData };

    for (const [field, label] of linkFields) {
      const raw = (formData[field] as string | undefined)?.trim();
      if (!raw) continue;

      const safe = toSafeExternalUrl(raw);
      if (!safe) {
        toast.error(`${label} inválido`, { description: 'Use um endereço http:// ou https://.' });
        return;
      }
      (normalized as any)[field] = safe;
    }

    onSave(normalized);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="flex max-h-[92vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl">
        <DialogHeader className="border-b border-border px-6 py-4 text-left">
          <DialogTitle className="text-lg font-semibold">
            {initialData ? 'Editar item' : 'Publicar na biblioteca'}
          </DialogTitle>
          <DialogDescription className="text-sm">
            Preencha o essencial para publicar. Os detalhes de iniciativa são opcionais.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 space-y-6 overflow-y-auto px-6 py-5">
          {/* 1. Tipo — define rótulos, ajuda e formato do conteúdo abaixo */}
          <section className="space-y-2">
            <Label className="text-sm font-medium">Tipo de item</Label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {TYPE_ORDER.map(type => {
                const meta = TYPE_META[type];
                const Icon = meta.icon;
                const isActive = formData.type === type;

                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => update({ type })}
                    title={meta.summary}
                    className={cn(
                      'flex items-center gap-2 rounded-lg border px-3 py-2.5 text-sm transition-colors',
                      isActive
                        ? 'border-foreground/25 bg-accent font-medium text-foreground'
                        : 'border-border text-muted-foreground hover:bg-accent/50 hover:text-foreground'
                    )}
                  >
                    <Icon className={cn('h-4 w-4 shrink-0', isActive && meta.accent)} />
                    {meta.label}
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground">{typeMeta.summary}</p>
          </section>

          {/* 2. Identificação */}
          <section className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="prompt-title" className="text-sm font-medium">
                Título
              </Label>
              <Input
                id="prompt-title"
                value={formData.title || ''}
                onChange={e => update({ title: e.target.value })}
                placeholder="Ex: Gerador de critérios de aceite em Gherkin"
                className="h-10"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="prompt-description" className="text-sm font-medium">
                Descrição
              </Label>
              <Textarea
                id="prompt-description"
                value={formData.description || ''}
                onChange={e => update({ description: e.target.value })}
                placeholder="O que este item resolve e quando usar."
                className="min-h-[72px] resize-y text-sm"
              />
              <p className="text-xs text-muted-foreground">
                Aparece no card e é usada na busca. Uma ou duas frases bastam.
              </p>
            </div>

            {similarItems.length > 0 && (
              <div className="space-y-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
                <p className="flex items-center gap-2 text-xs font-medium text-amber-700 dark:text-amber-400">
                  <TriangleAlert className="h-3.5 w-3.5 shrink-0" />
                  {similarItems.length === 1
                    ? 'Já existe um item parecido na biblioteca'
                    : 'Já existem itens parecidos na biblioteca'}
                </p>
                <ul className="space-y-1">
                  {similarItems.map(({ item, reason }) => (
                    <li key={item.id} className="flex items-baseline gap-2 text-xs">
                      <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
                        {SIMILARITY_REASON_LABEL[reason]}
                      </span>
                      <span className="min-w-0 truncate text-foreground">
                        {item.title?.trim() || 'Item sem título'}
                      </span>
                      <span className="shrink-0 text-muted-foreground">
                        · {item.authorName?.split(' ')[0] || 'Membro'}
                      </span>
                    </li>
                  ))}
                </ul>
                <p className="text-xs text-muted-foreground">
                  Considere editar o item existente em vez de criar outro. Se for uma variação
                  proposital, siga em frente.
                </p>
              </div>
            )}
          </section>

          {/* 3. Conteúdo — rótulo, dica e formato mudam conforme o tipo */}
          <section className="space-y-1.5">
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="prompt-content" className="text-sm font-medium">
                {typeMeta.contentLabel}
                {typeMeta.linkFirst && (
                  <span className="ml-2 font-normal text-muted-foreground">(opcional)</span>
                )}
              </Label>

              {formData.type === 'skill' && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => router.push('/prompt-hub/tutorial')}
                  className="h-7 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                >
                  <GraduationCap className="h-3.5 w-3.5" />
                  Ver tutorial
                </Button>
              )}
            </div>

            {typeMeta.contentHint && (
              <p className="flex items-start gap-2 rounded-lg bg-muted px-3 py-2 text-xs leading-relaxed text-muted-foreground">
                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                {typeMeta.contentHint}
              </p>
            )}

            <Textarea
              id="prompt-content"
              value={formData.content || ''}
              onChange={e => update({ content: e.target.value })}
              placeholder={typeMeta.contentPlaceholder}
              className={cn(
                'min-h-[220px] resize-y',
                typeMeta.mono ? 'font-code text-[13px] leading-relaxed' : 'text-sm'
              )}
            />

            {/* Conferência ao vivo do formato SKILL.md */}
            {skillCheck && (
              <div className="space-y-1.5 pt-1">
                {skillCheck.errors.length === 0 && skillCheck.warnings.length === 0 && (
                  <p className="flex items-center gap-2 text-xs text-emerald-700 dark:text-emerald-400">
                    <CircleCheck className="h-3.5 w-3.5 shrink-0" />
                    Formato válido
                    {skillCheck.name && (
                      <span className="font-code text-muted-foreground">— {skillCheck.name}</span>
                    )}
                  </p>
                )}

                {skillCheck.errors.map(error => (
                  <p
                    key={error}
                    className="flex items-start gap-2 text-xs leading-relaxed text-destructive"
                  >
                    <CircleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    {error}
                  </p>
                ))}

                {skillCheck.warnings.map(warning => (
                  <p
                    key={warning}
                    className="flex items-start gap-2 text-xs leading-relaxed text-amber-700 dark:text-amber-400"
                  >
                    <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    {warning}
                  </p>
                ))}

                {skillCheck.warnings.length > 0 && skillCheck.errors.length === 0 && (
                  <p className="pl-5 text-xs text-muted-foreground">
                    Avisos não impedem a publicação.
                  </p>
                )}
              </div>
            )}
          </section>

          {/* 4. Link — protagonista nos tipos que apontam para ferramenta externa */}
          <section className="space-y-1.5">
            <Label htmlFor="prompt-link" className="text-sm font-medium">
              Link da ferramenta
              {!typeMeta.linkFirst && (
                <span className="ml-2 font-normal text-muted-foreground">(opcional)</span>
              )}
            </Label>
            <div className="relative">
              <LinkIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="prompt-link"
                value={formData.gemLink || ''}
                onChange={e => update({ gemLink: e.target.value })}
                placeholder="https://gemini.google.com/gems/..."
                className="h-10 pl-9"
              />
            </div>
          </section>

          {/* 5. Visibilidade e tags */}
          <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Quem pode ver</Label>
              <Select
                value={formData.visibility}
                onValueChange={(value: PromptVisibility) => update({ visibility: value })}
              >
                <SelectTrigger className="h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(VISIBILITY_META) as PromptVisibility[])
                    .filter(key => VISIBILITY_META[key].available)
                    .map(key => (
                      <SelectItem key={key} value={key}>
                        {VISIBILITY_META[key].label}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {VISIBILITY_META[(formData.visibility as PromptVisibility) || 'private'].description}
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="prompt-tags" className="text-sm font-medium">
                Tags
              </Label>
              <Input
                id="prompt-tags"
                value={tagInput}
                onChange={e => setTagInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddTag(tagInput);
                  }
                }}
                placeholder="Digite e pressione Enter"
                className="h-10"
              />

              {formData.tags && formData.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {formData.tags.map(tag => (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-1 rounded-md bg-accent px-2 py-1 text-xs text-foreground"
                    >
                      #{tag}
                      <button
                        type="button"
                        onClick={() => removeTag(tag)}
                        className="text-muted-foreground hover:text-destructive"
                        title={`Remover ${tag}`}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}

              {(!formData.tags || formData.tags.length === 0) && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {SUGGESTED_TAGS.slice(0, 5).map(tag => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => handleAddTag(tag)}
                      className="rounded-md border border-dashed border-border px-2 py-0.5 text-xs text-muted-foreground hover:border-solid hover:text-foreground"
                    >
                      + {tag}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </section>

          {/* 6. Detalhes de iniciativa — recolhidos por padrão */}
          <section className="rounded-lg border border-border">
            <button
              type="button"
              onClick={() => setShowAdvanced(v => !v)}
              className="flex w-full items-center justify-between px-4 py-3 text-left"
            >
              <span className="text-sm font-medium text-foreground">Detalhes de iniciativa</span>
              <span className="flex items-center gap-2 text-xs text-muted-foreground">
                Objetivo, status, impacto, público-alvo
                <ChevronDown
                  className={cn('h-4 w-4 transition-transform', showAdvanced && 'rotate-180')}
                />
              </span>
            </button>

            {showAdvanced && (
              <div className="space-y-4 border-t border-border px-4 py-4">
                <div className="space-y-1.5">
                  <Label htmlFor="prompt-goal" className="text-sm font-medium">
                    Objetivo de negócio
                  </Label>
                  <Textarea
                    id="prompt-goal"
                    value={formData.businessGoal || ''}
                    onChange={e => update({ businessGoal: e.target.value })}
                    placeholder="Que problema isso resolve e qual ganho é esperado."
                    className="min-h-[64px] resize-y text-sm"
                  />
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium">Status</Label>
                    <Select value={formData.status} onValueChange={(v: any) => update({ status: v })}>
                      <SelectTrigger className="h-10">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ideacao">Ideação</SelectItem>
                        <SelectItem value="planejamento">Planejamento</SelectItem>
                        <SelectItem value="desenvolvimento">Em desenvolvimento</SelectItem>
                        <SelectItem value="producao">Em produção</SelectItem>
                        <SelectItem value="arquivado">Arquivado</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium">Impacto esperado</Label>
                    <Select value={formData.impact} onValueChange={(v: any) => update({ impact: v })}>
                      <SelectTrigger className="h-10">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="baixo">Baixo</SelectItem>
                        <SelectItem value="medio">Médio</SelectItem>
                        <SelectItem value="alto">Alto</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="prompt-audience" className="text-sm font-medium">
                      Público-alvo
                    </Label>
                    <Input
                      id="prompt-audience"
                      value={formData.targetAudience || ''}
                      onChange={e => update({ targetAudience: e.target.value })}
                      placeholder="Ex: devs, QA, produto"
                      className="h-10"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="prompt-doc" className="text-sm font-medium">
                      Link de documentação
                    </Label>
                    <Input
                      id="prompt-doc"
                      value={formData.architectureLink || ''}
                      onChange={e => update({ architectureLink: e.target.value })}
                      placeholder="Miro, Confluence, Notion..."
                      className="h-10"
                    />
                  </div>
                </div>
              </div>
            )}
          </section>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-border px-6 py-4">
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit}>{initialData ? 'Salvar alterações' : 'Publicar'}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

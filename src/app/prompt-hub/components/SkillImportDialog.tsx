'use client';

import React, { useState, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  FolderUp,
  FileCode2,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Upload,
  Sparkles,
  ArrowLeft
} from 'lucide-react';
import { toast } from 'sonner';
import { PromptItem, PromptVisibility } from '../types';
import { validateSkillFrontmatter, SkillValidation } from '../skillFrontmatter';
import { promptApi } from '../api';
import { AgileSpinner } from '@/components/ui/AgileSpinner';

interface SkillImportItem {
  id: string;
  file: File;
  relativePath: string;
  title: string;
  description: string;
  content: string;
  tags: string[];
  visibility: PromptVisibility;
  validation: SkillValidation;
  selected: boolean;
}

interface SkillImportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  currentUser?: {
    id: string;
    name?: string;
    role?: string;
    squadId?: string;
    avatarSeed?: string;
  };
}

export function SkillImportDialog({
  isOpen,
  onClose,
  onSuccess,
  currentUser
}: SkillImportDialogProps) {
  const [step, setStep] = useState<'pick' | 'preview' | 'importing'>('pick');
  const [items, setItems] = useState<SkillImportItem[]>([]);
  const [globalVisibility, setGlobalVisibility] = useState<PromptVisibility>('public');
  const [isDragOver, setIsDragOver] = useState(false);
  const [isScanning, setIsScanning] = useState(false);

  const folderInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetState = () => {
    setStep('pick');
    setItems([]);
    setIsScanning(false);
  };

  const handleClose = () => {
    if (step === 'importing') return;
    resetState();
    onClose();
  };

  /**
   * Processa uma lista bruta de arquivos e extrai aqueles que são SKILL.md
   * ou arquivos markdown com frontmatter YAML.
   */
  const processFiles = async (fileList: { file: File; relativePath: string }[]) => {
    setIsScanning(true);
    try {
      const candidates = fileList.filter(({ file, relativePath }) => {
        const lowerName = file.name.toLowerCase();
        const lowerPath = relativePath.toLowerCase();
        return (
          lowerName === 'skill.md' ||
          lowerPath.includes('/skills/') ||
          lowerPath.includes('\\skills\\') ||
          lowerName.endsWith('.md')
        );
      });

      if (candidates.length === 0) {
        toast.error('Nenhum arquivo de skill encontrado', {
          description: 'A pasta precisa conter arquivos SKILL.md ou arquivos .md com frontmatter.'
        });
        setIsScanning(false);
        return;
      }

      const parsed: SkillImportItem[] = [];

      for (const { file, relativePath } of candidates) {
        try {
          const content = await file.text();
          const validation = validateSkillFrontmatter(content);

          // Se não for SKILL.md exato e não tiver bloco de frontmatter, desconsidera
          if (file.name.toLowerCase() !== 'skill.md' && !validation.hasFrontmatter) {
            continue;
          }

          // Deriva o nome padrão: do frontmatter ou da pasta pai
          let derivedName = validation.name?.trim();
          if (!derivedName) {
            const parts = relativePath.split(/[/\\]/);
            // Pega o nome da pasta imediatamente superior se o arquivo for SKILL.md
            if (parts.length > 1 && parts[parts.length - 1].toLowerCase() === 'skill.md') {
              derivedName = parts[parts.length - 2];
            } else {
              derivedName = file.name.replace(/\.md$/i, '');
            }
          }

          // Inferência inicial de tags
          const tags = new Set<string>(['skill']);
          if (derivedName) {
            derivedName
              .toLowerCase()
              .split(/[-_]/)
              .filter(w => w.length > 2)
              .forEach(w => tags.add(w));
          }

          parsed.push({
            id: Math.random().toString(36).substring(2, 9),
            file,
            relativePath,
            title: derivedName || 'Nova Skill',
            description: validation.description || '',
            content,
            tags: Array.from(tags),
            visibility: globalVisibility,
            validation,
            selected: validation.errors.length === 0
          });
        } catch (err) {
          console.warn(`Erro ao ler arquivo ${relativePath}:`, err);
        }
      }

      if (parsed.length === 0) {
        toast.error('Nenhum SKILL.md válido encontrado na pasta selecionada.');
        setIsScanning(false);
        return;
      }

      setItems(parsed);
      setStep('preview');
    } catch (err: any) {
      toast.error('Erro ao ler arquivos da pasta', { description: err?.message });
    } finally {
      setIsScanning(false);
    }
  };

  // Seletor nativo de pasta do navegador (HTML5 webkitdirectory)
  const handleDirectoryChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const list: { file: File; relativePath: string }[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const relativePath = file.webkitRelativePath || file.name;
      list.push({ file, relativePath });
    }

    await processFiles(list);
    e.target.value = '';
  };

  // Seletor de múltiplos arquivos .md
  const handleFilesChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const list: { file: File; relativePath: string }[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      list.push({ file, relativePath: file.name });
    }

    await processFiles(list);
    e.target.value = '';
  };

  // Drag and drop recursivo de pastas e arquivos
  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);

    const dataItems = e.dataTransfer.items;
    if (!dataItems || dataItems.length === 0) return;

    setIsScanning(true);
    const collected: { file: File; relativePath: string }[] = [];

    // Leitura recursiva usando File System Entry API
    const traverseEntry = async (entry: any, currentPath: string): Promise<void> => {
      if (!entry) return;
      if (entry.isFile) {
        try {
          const file = await new Promise<File>((resolve, reject) => entry.file(resolve, reject));
          collected.push({ file, relativePath: `${currentPath}${file.name}` });
        } catch {
          // ignora falha de arquivo inacessível
        }
      } else if (entry.isDirectory) {
        const reader = entry.createReader();
        const readAllEntries = async (): Promise<any[]> => {
          const batch: any[] = await new Promise((resolve, reject) => reader.readEntries(resolve, reject));
          if (batch.length > 0) {
            const next = await readAllEntries();
            return [...batch, ...next];
          }
          return batch;
        };

        try {
          const dirEntries = await readAllEntries();
          for (const child of dirEntries) {
            await traverseEntry(child, `${currentPath}${entry.name}/`);
          }
        } catch {
          // ignora pasta inacessível
        }
      }
    };

    try {
      const promises: Promise<void>[] = [];
      for (let i = 0; i < dataItems.length; i++) {
        const entry = dataItems[i].webkitGetAsEntry?.();
        if (entry) {
          promises.push(traverseEntry(entry, ''));
        }
      }
      await Promise.all(promises);

      if (collected.length > 0) {
        await processFiles(collected);
      } else {
        // Fallback caso webkitGetAsEntry não seja suportado
        const fallbackFiles: { file: File; relativePath: string }[] = [];
        for (let i = 0; i < e.dataTransfer.files.length; i++) {
          const f = e.dataTransfer.files[i];
          fallbackFiles.push({ file: f, relativePath: f.name });
        }
        await processFiles(fallbackFiles);
      }
    } catch (err: any) {
      toast.error('Falha ao processar arquivos arrastados', { description: err?.message });
      setIsScanning(false);
    }
  };

  const handleToggleSelectAll = (checked: boolean) => {
    setItems(prev => prev.map(item => ({ ...item, selected: checked })));
  };

  const handleToggleItem = (id: string, checked: boolean) => {
    setItems(prev => prev.map(item => (item.id === id ? { ...item, selected: checked } : item)));
  };

  const handleUpdateItem = (id: string, patch: Partial<SkillImportItem>) => {
    setItems(prev => prev.map(item => (item.id === id ? { ...item, ...patch } : item)));
  };

  const handleGlobalVisibilityChange = (visibility: PromptVisibility) => {
    setGlobalVisibility(visibility);
    setItems(prev => prev.map(item => ({ ...item, visibility })));
  };

  // Executa o envio em lote para o backend
  const handleConfirmImport = async () => {
    const selected = items.filter(i => i.selected);
    if (selected.length === 0) {
      toast.error('Nenhuma skill selecionada para importação.');
      return;
    }

    setStep('importing');

    const authorId = currentUser?.id || 'anonymous';
    const authorName = currentUser?.name || 'Membro';
    const authorRole = currentUser?.role || 'Engenheiro';
    const authorSquad = currentUser?.squadId || 'Squad Geral';
    const authorAvatar = currentUser?.avatarSeed || '';

    const payloads: Partial<PromptItem>[] = selected.map(item => ({
      title: item.title.trim(),
      description: item.description.trim() || undefined,
      content: item.content,
      type: 'skill',
      visibility: item.visibility,
      status: 'producao',
      impact: 'medio',
      authorId,
      authorName,
      authorRole,
      authorSquad,
      authorAvatar,
      tags: item.tags,
      useCount: 0,
      forkCount: 0
    }));

    try {
      await promptApi.createPromptsBatch(payloads);
      toast.success(
        selected.length === 1
          ? 'Skill importada com sucesso!'
          : `${selected.length} skills importadas com sucesso!`,
        {
          description: 'As skills já estão disponíveis e formatadas no Prompt Hub.'
        }
      );
      onSuccess();
      handleClose();
    } catch (err: any) {
      console.error('Erro na importação em lote:', err);
      toast.error('Erro ao importar skills', { description: err?.message || 'Tente novamente.' });
      setStep('preview');
    }
  };

  const selectedCount = items.filter(i => i.selected).length;
  const validCount = items.filter(i => i.validation.errors.length === 0).length;
  const invalidCount = items.length - validCount;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="flex max-h-[92vh] w-full max-w-4xl lg:max-w-5xl xl:max-w-6xl flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="border-b border-border px-6 py-4 text-left">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <FolderUp className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-semibold">Importar Skills em Lote</DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Suba pastas de agentes (ex: <code className="text-foreground">.agents</code>, <code className="text-foreground">skills/</code>) com formato aberto <code className="text-foreground">SKILL.md</code>
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Inputs ocultos para seleção de pasta e arquivos */}
        <input
          type="file"
          ref={folderInputRef}
          className="hidden"
          // @ts-expect-error webkitdirectory é padrão HTML5 de diretório
          webkitdirectory=""
          directory=""
          multiple
          onChange={handleDirectoryChange}
        />
        <input
          type="file"
          ref={fileInputRef}
          className="hidden"
          accept=".md"
          multiple
          onChange={handleFilesChange}
        />

        {/* ETAPA 1: Seleção de Pasta / Arquivos */}
        {step === 'pick' && (
          <div className="flex flex-1 flex-col p-6">
            <div
              onDragOver={e => {
                e.preventDefault();
                setIsDragOver(true);
              }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={handleDrop}
              onClick={() => folderInputRef.current?.click()}
              className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-10 text-center transition-all ${
                isDragOver
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:border-primary/50 hover:bg-muted/30'
              }`}
            >
              {isScanning ? (
                <div className="flex flex-col items-center gap-3">
                  <AgileSpinner size="md" variant="indigo" />
                  <p className="text-sm font-medium text-foreground">
                    Varrendo arquivos e validando frontmatters...
                  </p>
                </div>
              ) : (
                <>
                  <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <Upload className="h-7 w-7" />
                  </div>
                  <h3 className="text-base font-semibold text-foreground">
                    Arraste sua pasta de skills aqui
                  </h3>
                  <p className="mt-1 max-w-md text-xs text-muted-foreground">
                    Detecta automaticamente arquivos <strong className="text-foreground">SKILL.md</strong> recursivamente dentro de pastas como <code className="rounded bg-muted px-1 py-0.5">.agents</code>, <code className="rounded bg-muted px-1 py-0.5">.claude/skills</code> ou qualquer subdiretório.
                  </p>

                  <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                    <Button
                      type="button"
                      variant="default"
                      size="sm"
                      className="gap-2"
                      onClick={e => {
                        e.stopPropagation();
                        folderInputRef.current?.click();
                      }}
                    >
                      <FolderUp className="h-4 w-4" />
                      Selecionar Pasta Local
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="gap-2"
                      onClick={e => {
                        e.stopPropagation();
                        fileInputRef.current?.click();
                      }}
                    >
                      <FileCode2 className="h-4 w-4" />
                      Selecionar Arquivos .md
                    </Button>
                  </div>
                </>
              )}
            </div>

            <div className="mt-5 rounded-lg border border-border/80 bg-muted/20 p-4 text-xs text-muted-foreground">
              <div className="flex items-center gap-2 font-medium text-foreground">
                <Sparkles className="h-4 w-4 text-primary" />
                Compatibilidade e Inferência Automática
              </div>
              <p className="mt-1 leading-relaxed">
                O Espaço Ágil lê os blocos <code className="text-foreground">--- YAML ---</code> no topo de cada <code className="text-foreground">SKILL.md</code> para extrair o <strong>nome</strong>, <strong>descrição</strong> e gerar as tags de categorização. Skills com o mesmo nome já existentes serão atualizadas automaticamente (idempotência).
              </p>
            </div>
          </div>
        )}

        {/* ETAPA 2: Pré-visualização e Edição antes de Salvar */}
        {step === 'preview' && (
          <div className="flex flex-1 flex-col overflow-hidden">
            {/* Barra de controle em lote */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-muted/30 px-6 py-3 text-xs">
              <div className="flex items-center gap-4">
                <label className="flex cursor-pointer items-center gap-2 font-medium text-foreground">
                  <Checkbox
                    checked={selectedCount === items.length && items.length > 0}
                    onCheckedChange={checked => handleToggleSelectAll(!!checked)}
                  />
                  <span>Selecionar todas ({items.length})</span>
                </label>

                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="gap-1 border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 className="h-3 w-3" />
                    {validCount} válidas
                  </Badge>
                  {invalidCount > 0 && (
                    <Badge variant="outline" className="gap-1 border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400">
                      <AlertTriangle className="h-3 w-3" />
                      {invalidCount} com avisos
                    </Badge>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">Visibilidade padrão:</span>
                <select
                  value={globalVisibility}
                  onChange={e => handleGlobalVisibilityChange(e.target.value as PromptVisibility)}
                  className="rounded border border-border bg-background px-2 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="public">Pública (Recomendado)</option>
                  <option value="private">Privada</option>
                  <option value="squad">Squad</option>
                </select>
              </div>
            </div>

            {/* Lista rolável de skills encontradas */}
            <div className="flex-1 overflow-y-auto p-6 space-y-3">
              {items.map(item => {
                const hasErrors = item.validation.errors.length > 0;
                const hasWarnings = item.validation.warnings.length > 0;

                return (
                  <div
                    key={item.id}
                    className={`rounded-lg border p-4 transition-all ${
                      item.selected
                        ? 'border-primary/40 bg-card shadow-sm'
                        : 'border-border bg-muted/10 opacity-70'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <Checkbox
                        checked={item.selected}
                        onCheckedChange={checked => handleToggleItem(item.id, !!checked)}
                        className="mt-1"
                      />

                      <div className="flex-1 space-y-2">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <Input
                              value={item.title}
                              onChange={e => handleUpdateItem(item.id, { title: e.target.value })}
                              className="h-8 font-semibold text-sm w-64 bg-background"
                              placeholder="Nome da skill"
                            />
                            <span className="text-[11px] text-muted-foreground font-mono">
                              {item.relativePath}
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            {hasErrors ? (
                              <Badge variant="destructive" className="gap-1 text-[11px]">
                                <XCircle className="h-3 w-3" />
                                Formato inválido
                              </Badge>
                            ) : hasWarnings ? (
                              <Badge variant="outline" className="gap-1 border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[11px]">
                                <AlertTriangle className="h-3 w-3" />
                                {item.validation.warnings.length} avisos
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="gap-1 border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[11px]">
                                <CheckCircle2 className="h-3 w-3" />
                                Válida
                              </Badge>
                            )}

                            <select
                              value={item.visibility}
                              onChange={e =>
                                handleUpdateItem(item.id, {
                                  visibility: e.target.value as PromptVisibility
                                })
                              }
                              className="rounded border border-border bg-background px-2 py-1 text-xs text-foreground focus:outline-none"
                            >
                              <option value="public">Pública</option>
                              <option value="private">Privada</option>
                              <option value="squad">Squad</option>
                            </select>
                          </div>
                        </div>

                        <Textarea
                          value={item.description}
                          onChange={e => handleUpdateItem(item.id, { description: e.target.value })}
                          rows={2}
                          className="text-xs text-muted-foreground resize-none bg-background"
                          placeholder="Descrição da finalidade da skill..."
                        />

                        {/* Avisos e tags */}
                        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                          <div className="flex flex-wrap gap-1">
                            {item.tags.map(t => (
                              <Badge key={t} variant="secondary" className="text-[10px] px-1.5 py-0">
                                #{t}
                              </Badge>
                            ))}
                          </div>

                          {hasErrors && (
                            <span className="text-[11px] text-destructive">
                              {item.validation.errors[0]}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ETAPA 3: Importando em Progresso */}
        {step === 'importing' && (
          <div className="flex flex-1 flex-col items-center justify-center p-12 text-center">
            <AgileSpinner size="lg" variant="indigo" />
            <h3 className="mt-4 text-base font-semibold text-foreground">
              Importando Skills no Prompt Hub...
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Salvando metadados, tags e instruções das skills no banco de dados.
            </p>
          </div>
        )}

        {/* Rodapé com botões de ação */}
        <DialogFooter className="border-t border-border px-6 py-3 bg-muted/20">
          {step === 'pick' && (
            <Button variant="ghost" size="sm" onClick={handleClose}>
              Cancelar
            </Button>
          )}

          {step === 'preview' && (
            <div className="flex w-full items-center justify-between">
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={() => setStep('pick')}
              >
                <ArrowLeft className="h-4 w-4" />
                Escolher outra pasta
              </Button>

              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={handleClose}>
                  Cancelar
                </Button>
                <Button
                  variant="default"
                  size="sm"
                  className="gap-2"
                  disabled={selectedCount === 0}
                  onClick={handleConfirmImport}
                >
                  <Upload className="h-4 w-4" />
                  Importar {selectedCount} {selectedCount === 1 ? 'Skill' : 'Skills'}
                </Button>
              </div>
            </div>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

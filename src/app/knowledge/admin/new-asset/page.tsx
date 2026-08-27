"use client";

import React, { useState, useEffect, Suspense, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  ArrowLeft, 
  Save, 
  Trash2, 
  FilePlus, 
  BookOpen, 
  Hash, 
  MapPin, 
  AlertCircle,
  Bold,
  Italic,
  Underline as UnderlineIcon,
  List,
  ListOrdered,
  Link,
  Code,
  Layout,
  ChevronLeft,
  Loader2,
  Heading1,
  Heading2,
  Clock,
  Database,
  Strikethrough,
  Highlighter,
  TrendingUp,
  Zap
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { knowledgeApi } from '@/app/knowledge/api';
import { toast } from 'sonner';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from '@/lib/utils';
import { AgileSpinner } from '@/components/ui/AgileSpinner';
import type { KnowledgeDocument } from '@/lib/knowledge-types';

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';

// Integrated Toolbar Component
const EditorToolbar = ({ 
  onSave, onBack, isLoading, isEditing, onImportClick, editor 
}: { 
  onSave: () => void, 
  onBack: () => void, 
  isLoading: boolean, 
  isEditing: boolean,
  onImportClick: () => void,
  editor: any
}) => {
  if (!editor) return null;

  return (
    <div className="sticky top-0 z-50 flex items-center gap-1 p-2 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm border-b border-slate-200 dark:border-slate-800 overflow-x-auto no-scrollbar shadow-sm">
      <div className="flex items-center gap-1 border-r border-slate-200 dark:border-slate-800 pr-3 mr-2">
         <Button variant="ghost" size="icon" onClick={onBack} className="h-8 w-8 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg">
            <ChevronLeft className="h-5 w-5" />
         </Button>
         <div className="h-4 w-px bg-slate-300 dark:bg-slate-700 mx-1 hidden sm:block" />
         <span className="text-[10px] font-black uppercase tracking-tighter text-slate-400 dark:text-slate-500 px-2 hidden sm:block whitespace-nowrap">
            {isEditing ? 'EditandoDoc' : 'NovoDoc'}
         </span>
      </div>

      <div className="flex items-center gap-0.5 border-r border-slate-200 dark:border-slate-800 pr-2 mr-1">
        <Button 
          variant={editor.isActive('bold') ? 'secondary' : 'ghost'} 
          size="icon" 
          onClick={() => editor.chain().focus().toggleBold().run()}
          className="h-8 w-8 text-slate-600 dark:text-slate-400 rounded"
        >
          <Bold className="h-4 w-4" />
        </Button>
        <Button 
          variant={editor.isActive('italic') ? 'secondary' : 'ghost'} 
          size="icon" 
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className="h-8 w-8 text-slate-600 dark:text-slate-400 rounded"
        >
          <Italic className="h-4 w-4" />
        </Button>
        <Button 
          variant={editor.isActive('underline') ? 'secondary' : 'ghost'} 
          size="icon" 
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          className="h-8 w-8 text-slate-600 dark:text-slate-400 rounded"
        >
          <UnderlineIcon className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex items-center gap-0.5 border-r border-slate-200 dark:border-slate-800 pr-2 mr-1 hidden md:flex">
        <Button 
          variant={editor.isActive('heading', { level: 1 }) ? 'secondary' : 'ghost'}
          size="icon" 
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          className="h-8 w-8 text-slate-600 dark:text-slate-400 rounded"
        >
          <Heading1 className="h-4 w-4" />
        </Button>
        <Button 
          variant={editor.isActive('heading', { level: 2 }) ? 'secondary' : 'ghost'}
          size="icon" 
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          className="h-8 w-8 text-slate-600 dark:text-slate-400 rounded"
        >
          <Heading2 className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex items-center gap-0.5 border-r border-slate-200 dark:border-slate-800 pr-2 mr-1">
        <Button 
          variant={editor.isActive('bulletList') ? 'secondary' : 'ghost'} 
          size="icon" 
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className="h-8 w-8 text-slate-600 dark:text-slate-400 rounded"
        >
          <List className="h-4 w-4" />
        </Button>
        <Button 
          variant={editor.isActive('orderedList') ? 'secondary' : 'ghost'} 
          size="icon" 
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className="h-8 w-8 text-slate-600 dark:text-slate-400 rounded"
        >
          <ListOrdered className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex items-center gap-0.5 border-r border-slate-200 dark:border-slate-800 pr-2 mr-1">
        <Button 
          variant={editor.isActive('codeBlock') ? 'secondary' : 'ghost'} 
          size="icon" 
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
          className="h-8 w-8 text-slate-600 dark:text-slate-400 rounded"
        >
          <Code className="h-4 w-4" />
        </Button>
      </div>

      <div className="ml-auto flex items-center gap-2 pr-1">
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={onImportClick}
          className="h-8 px-3 rounded-lg border-slate-200 dark:border-slate-800 text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-900/40 flex items-center gap-2"
        >
          <FilePlus className="h-3.5 w-3.5" /> Importar
        </Button>
        <Button 
          size="sm" 
          onClick={onSave}
          disabled={isLoading}
          className="h-8 px-5 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 rounded-lg font-black uppercase text-[10px] tracking-widest shadow-lg hover:bg-black dark:hover:bg-slate-200 transition-all gap-2"
        >
          {isLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3 text-cyan-400" />}
          {isLoading ? 'Salvando' : 'Salvar'}
        </Button>
      </div>
    </div>
  );
};

function NewAssetContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const assetId = searchParams.get('id');
  const { session } = useAuth();

  const [allDocs, setAllDocs] = useState<KnowledgeDocument[]>([]);

  useEffect(() => {
    if (!session) return;
    knowledgeApi.listDocuments(undefined, undefined, 0, 200)
      .then(response => setAllDocs(response.content))
      .catch(err => console.error('Erro ao carregar sugestões de caminho:', err));
  }, [session]);

  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    category: 'Processo',
    fullPath: '',
    content: '',
    status: 'published'
  });

  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const extensions = useMemo(() => [
    StarterKit,
  ], []);

  const editor = useEditor({
    extensions,
    content: '',
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: 'prose prose-slate max-w-none focus:outline-none min-h-[600px] p-10 font-sans text-[16px] leading-relaxed',
      },
    },
    onUpdate: ({ editor }) => {
      setFormData(prev => ({ ...prev, content: editor.getHTML() }));
    },
  });

  useEffect(() => {
    if (assetId) {
      const loadAsset = async () => {
        try {
          const data = await knowledgeApi.getDocumentById(assetId);
          const loadedData = {
            title: data.title || '',
            category: data.category || 'Processo',
            fullPath: data.fullPath || '',
            content: data.content || '',
            status: data.status || 'published'
          };
          setFormData(loadedData);
          if (editor) {
            editor.commands.setContent(data.content || '');
          }
        } catch (err: any) {
          toast.error('Erro ao carregar o documento: ' + err.message);
        }
      };
      loadAsset();
    }
  }, [assetId, editor]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || file.name.toLowerCase().endsWith('.docx')) {
      const loadingToast = toast.loading(`Importando Word: ${file.name}...`);
      setIsLoading(true);
      try {
        const formDataPayload = new FormData();
        formDataPayload.append('file', file);
        const response = await fetch('/api/knowledge/ingest-pdf', { method: 'POST', body: formDataPayload });
        const data = await response.json();
        if (data.text && editor) {
          editor.commands.setContent(data.text);
          setFormData(prev => ({ ...prev, title: prev.title || file.name.split('.')[0] }));
          toast.success(`Word importado!`, { id: loadingToast });
        }
      } catch (err: any) {
        toast.error(`Erro: ${err.message}`, { id: loadingToast });
      } finally {
        setIsLoading(false);
      }
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (editor) editor.commands.setContent(content);
      setFormData(prev => ({ ...prev, title: prev.title || file.name.split('.')[0] }));
      toast.success(`Arquivo importado!`);
    };
    reader.readAsText(file);
  };

  const handleSave = async () => {
    if (!session) return;
    if (!formData.title || !formData.content) {
        toast.error('Preencha título e conteúdo');
        return;
    }
    setIsLoading(true);

    try {
      const payload: Partial<KnowledgeDocument> = {
        title: formData.title,
        category: formData.category,
        fullPath: formData.fullPath,
        content: formData.content,
        status: formData.status as KnowledgeDocument['status'],
        updatedBy: session.id,
        authorId: session.id,
        byteSize: new Blob([formData.content]).size,
      };

      if (assetId) {
        await knowledgeApi.updateDocument(assetId, payload);
      } else {
        await knowledgeApi.saveOrUpdateDocument(payload);
      }
      toast.success(assetId ? 'Documento atualizado' : 'Documento salvo');
      router.push('/knowledge/kb');
    } catch (error: any) {
      toast.error('Erro ao salvar: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };
  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden bg-[#f8fafc] dark:bg-slate-950">
      <div className="flex-1 flex overflow-hidden">
        {/* Main Editor Area */}
        <main className="flex-1 overflow-y-auto no-scrollbar p-6 lg:p-8">
          <div className="max-w-6xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
             <Card className="border border-slate-200 dark:border-slate-800 rounded-[2rem] bg-white dark:bg-slate-900 overflow-hidden shadow-2xl flex flex-col min-h-[850px]">
                <EditorToolbar 
                   onSave={handleSave} 
                   onBack={() => router.push('/knowledge/kb')} 
                   isLoading={isLoading} 
                   isEditing={!!assetId}
                   onImportClick={() => fileInputRef.current?.click()}
                   editor={editor}
                />

                <input 
                   type="file" 
                   ref={fileInputRef} 
                   onChange={handleFileUpload} 
                   className="hidden" 
                   accept=".txt,.md,.json,.docx" 
                />

                <ScrollArea className="flex-1 bg-white dark:bg-slate-900">
                   <div className="max-w-[900px] mx-auto min-h-full">
                      <EditorContent editor={editor} />
                   </div>
                </ScrollArea>
             </Card>
          </div>
        </main>

        {/* Professional Sidebar */}
        <aside className="w-[380px] border-l border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 flex flex-col shrink-0 hidden xl:flex">
          <div className="p-8 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40">
             <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-slate-900 dark:bg-slate-950 rounded-lg flex items-center justify-center shadow-lg transform -rotate-3">
                   <BookOpen className="h-4 w-4 text-cyan-400" />
                </div>
                <div>
                   <h3 className="text-[11px] font-black uppercase tracking-[0.25em] text-slate-900 dark:text-slate-100 leading-none">Configurações</h3>
                   <p className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase mt-1">Metadados do Ativo</p>
                </div>
             </div>
          </div>

          <ScrollArea className="flex-1">
             <div className="p-8 space-y-8">
                {/* Info Group */}
                <div className="space-y-6">
                   <div className="space-y-2">
                       <label className="text-[10px] font-black uppercase text-slate-500 dark:text-slate-400 tracking-[0.15em] ml-1">Título do Documento</label>
                       <Input 
                         value={formData.title} 
                         onChange={e => setFormData({...formData, title: e.target.value})}
                         className="h-11 px-4 rounded-xl border-slate-200 dark:border-slate-800 font-bold text-[13px] bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-cyan-500/20 transition-all shadow-sm"
                         placeholder="Ex: API de Pedidos"
                       />
                   </div>

                   <div className="space-y-2">
                       <label className="text-[10px] font-black uppercase text-slate-500 dark:text-slate-400 tracking-[0.15em] ml-1">Categoria Técnica</label>
                       <Select value={formData.category} onValueChange={v => setFormData({...formData, category: v})}>
                          <SelectTrigger className="h-11 rounded-xl border-slate-200 dark:border-slate-800 font-bold text-[13px] bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">
                             <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="rounded-xl">
                             <SelectItem value="Processo">Processo</SelectItem>
                             <SelectItem value="Técnico">Técnico</SelectItem>
                             <SelectItem value="Negócio">Negócio</SelectItem>
                             <SelectItem value="Suporte">Suporte</SelectItem>
                          </SelectContent>
                       </Select>
                   </div>

                   <div className="space-y-2">
                       <label className="text-[10px] font-black uppercase text-slate-500 dark:text-slate-400 tracking-[0.15em] ml-1">Localização (Caminho)</label>
                       <div className="relative group">
                         <MapPin className="h-4 w-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-cyan-500 transition-colors pointer-events-none z-10" />
                         <Input 
                           value={formData.fullPath} 
                           onChange={e => setFormData({...formData, fullPath: e.target.value})}
                           className="h-11 pl-11 pr-4 rounded-xl border-slate-200 dark:border-slate-800 font-bold text-[13px] bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-cyan-500/20 transition-all shadow-sm"
                           placeholder="Módulo / Pasta"
                         />
                       </div>
                       <div className="p-3 bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800 rounded-xl mt-2">
                          <p className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2 px-1">Atalhos:</p>
                          <div className="flex flex-wrap gap-1.5">
                             {Array.from(new Set(allDocs?.map(d => d.fullPath?.split('/').slice(0, -1).join(' / ')).filter(Boolean))).sort().slice(0, 5).map(path => (
                                <button
                                   key={path}
                                   type="button"
                                   onClick={() => setFormData({...formData, fullPath: path as string})}
                                   className="px-3 py-1 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-[9px] font-bold text-slate-600 dark:text-slate-400 hover:border-cyan-500 hover:text-cyan-600 transition-all shadow-sm"
                                >
                                   {path}
                                </button>
                             ))}
                          </div>
                       </div>
                    </div>

                    <div className="space-y-2">
                       <label className="text-[10px] font-black uppercase text-slate-500 dark:text-slate-400 tracking-[0.15em] ml-1">Status na Base</label>
                       <Select value={formData.status} onValueChange={v => setFormData({...formData, status: v})}>
                          <SelectTrigger className="h-11 rounded-xl border-slate-200 dark:border-slate-800 font-bold text-[13px] bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 uppercase italic tracking-tighter">
                             <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="rounded-xl">
                             <SelectItem value="published">Ativo (Público)</SelectItem>
                             <SelectItem value="draft">Rascunho Interno</SelectItem>
                             <SelectItem value="archived">Arquivado</SelectItem>
                          </SelectContent>
                       </Select>
                    </div>
                 </div>

                 {/* Telemetry Card */}
                 <div className="pt-4">
                    <div className="p-6 bg-slate-900 dark:bg-slate-950 rounded-[2rem] shadow-2xl relative overflow-hidden group">
                       <div className="absolute -right-6 -top-6 opacity-10 group-hover:scale-125 transition-transform duration-700">
                          <TrendingUp className="h-24 w-24 text-white" />
                       </div>
                       <div className="relative z-10 space-y-4">
                          <div className="flex items-center gap-2">
                             <Clock className="h-3.5 w-3.5 text-cyan-400" />
                             <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-white">Análise do Ativo</h4>
                          </div>
                          <div className="grid grid-cols-2 gap-4 border-t border-white/10 pt-4">
                              <div>
                                 <p className="text-[8px] font-bold text-slate-500 uppercase tracking-widest">Tamanho</p>
                                 <p className="text-sm font-black text-white italic">{(new Blob([formData.content]).size / 1024).toFixed(1)} <span className="text-[10px] not-italic text-slate-400 font-bold">KB</span></p>
                              </div>
                              <div>
                                 <p className="text-[8px] font-bold text-slate-500 uppercase tracking-widest">Otimização</p>
                                 <p className="text-sm font-black text-emerald-400 flex items-center gap-1.5">
                                    98% <Zap className="h-3 w-3" />
                                 </p>
                              </div>
                          </div>
                       </div>
                    </div>
                 </div>
              </div>
           </ScrollArea>
        </aside>
      </div>
    </div>
  );
}

export default function KnowledgeAdminNewAssetPage() {
  return (
    <Suspense fallback={<div className="flex-1 flex items-center justify-center bg-white dark:bg-slate-950"><AgileSpinner size="md" variant="indigo" /></div>}>
      <NewAssetContent />
    </Suspense>
  );
}

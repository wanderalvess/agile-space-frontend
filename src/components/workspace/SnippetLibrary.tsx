'use client';

import React, { useState, useMemo, useEffect } from 'react';

import { 
  Plus, 
  Search, 
  Code, 
  Copy, 
  Trash2, 
  Terminal, 
  FileCode,
  Tag,
  Eye,
  Pencil,
  ChevronDown,
  Loader2
} from 'lucide-react';
import { Editor } from '@monaco-editor/react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { useFirebase, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, serverTimestamp, setDoc, doc, deleteDoc, Timestamp } from 'firebase/firestore';
import { toast } from 'sonner';
import { EliteSpinner } from '@/components/ui/EliteSpinner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from '@/components/ui/label';

interface Snippet {
  id: string;
  title: string;
  description: string;
  code: string;
  language: string;
  tags: string[];
  updatedAt: Timestamp;
}

const LANGUAGES = [
  'javascript', 'typescript', 'python', 'sql', 'bash', 'json', 'html', 'css', 'java', 'csharp', 'other'
];

export function SnippetLibrary() {
  const { firestore, user } = useFirebase();
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingSnippet, setEditingSnippet] = useState<Snippet | null>(null);
  const [search, setSearch] = useState('');

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    code: '',
    language: 'javascript',
    tags: ''
  });

  const snippetsQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return query(
      collection(firestore, 'users', user.uid, 'snippets'),
      orderBy('updatedAt', 'desc')
    );
  }, [firestore, user]);

  const { data: snippets, isLoading } = useCollection<Snippet>(snippetsQuery);
  
  useEffect(() => {
    const handleNewSnippetEvent = () => {
      handleOpenEditor();
    };
    window.addEventListener('agile-space:new-snippet', handleNewSnippetEvent);
    return () => window.removeEventListener('agile-space:new-snippet', handleNewSnippetEvent);
  }, []);


  const filteredSnippets = useMemo(() => {
    if (!snippets) return [];
    if (!search) return snippets;
    
    const searchLower = search.toLowerCase();
    return snippets.filter(item => 
      item.title.toLowerCase().includes(searchLower) || 
      item.description.toLowerCase().includes(searchLower) ||
      item.code.toLowerCase().includes(searchLower) ||
      item.tags.some(t => t.toLowerCase().includes(searchLower))
    );
  }, [snippets, search]);

  const handleOpenEditor = (snippet?: Snippet) => {
    if (snippet) {
      setEditingSnippet(snippet);
      setFormData({
        title: snippet.title,
        description: snippet.description,
        code: snippet.code,
        language: snippet.language,
        tags: snippet.tags.join(', ')
      });
    } else {
      setEditingSnippet(null);
      setFormData({
        title: '',
        description: '',
        code: '',
        language: 'javascript',
        tags: ''
      });
    }
    setIsEditorOpen(true);
  };

  const handleSave = async () => {
    if (!firestore || !user) return;
    if (!formData.title.trim() || !formData.code.trim()) return;

    const id = editingSnippet?.id || `snippet_${Date.now()}`;
    const payload = {
      id,
      title: formData.title.trim(),
      description: formData.description.trim(),
      code: formData.code.trim(),
      language: formData.language,
      tags: formData.tags.split(',').map(t => t.trim()).filter(t => t),
      updatedAt: serverTimestamp()
    };

    try {
      await setDoc(doc(firestore, 'users', user.uid, 'snippets', id), payload, { merge: true });
      toast.success('Snippet salvo com sucesso!');
      setIsEditorOpen(false);
    } catch (err: any) {
      toast.error('Erro ao salvar: ' + err.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!firestore || !user || !confirm('Deseja realmente excluir este snippet?')) return;
    try {
      await deleteDoc(doc(firestore, 'users', user.uid, 'snippets', id));
      toast.success('Snippet removido.');
    } catch (err: any) {
      toast.error('Erro ao remover: ' + err.message);
    }
  };

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success('Código copiado!');
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center h-[60vh]">
        <EliteSpinner size="md" variant="indigo" />
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-3xl font-black uppercase tracking-tighter italic text-slate-900 leading-none">
            Snippet <span className="text-indigo-600 not-italic">Library</span>
          </h2>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2">
            Organize seus fragmentos de código e utilitários técnicos.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative w-full md:w-72 group">
            <Search className="h-4 w-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
            <Input 
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar snippet por título, tag ou código..."
              className="h-12 pl-10 rounded-2xl border-slate-200 bg-white shadow-sm focus:ring-4 focus:ring-indigo-500/5 text-xs font-bold"
            />
          </div>
          <Button 
            onClick={() => handleOpenEditor()}
            className="h-12 px-6 bg-slate-900 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl hover:bg-black transition-all gap-2 shrink-0"
          >
            <Plus className="h-5 w-5 text-indigo-400" /> Novo Snippet
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-6">
        {filteredSnippets.length === 0 ? (
          <div className="col-span-full flex flex-col items-center justify-center py-32 text-center bg-white border border-slate-100 rounded-[3rem] shadow-sm">
            <div className="w-20 h-20 bg-slate-50 rounded-[2rem] flex items-center justify-center mb-8">
              <Code className="h-10 w-10 text-slate-200" />
            </div>
            <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter italic">Nenhum snippet encontrado</h3>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest max-w-[280px] mt-2 leading-relaxed">
              Sua biblioteca está vazia ou os filtros não retornaram resultados. Comece a documentar seus códigos reutilizáveis.
            </p>
          </div>
        ) : (
          filteredSnippets.map(snippet => (
            <div key={snippet.id} className="group relative bg-white rounded-[2.5rem] border border-slate-200/60 p-6 transition-all duration-500 hover:border-indigo-200 hover:shadow-2xl hover:shadow-indigo-500/5 flex flex-col h-full overflow-hidden">
               {/* Language Tag Badge */}
               <div className="absolute -right-2 -top-2 opacity-[0.03] pointer-events-none group-hover:opacity-[0.08] group-hover:scale-125 transition-all duration-700">
                  <Terminal className="h-32 w-32 -rotate-12" />
               </div>

               <div className="flex-1 space-y-4">
                  <div className="flex items-start justify-between gap-4">
                     <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-indigo-50 flex items-center justify-center group-hover:bg-indigo-600 transition-colors">
                           <FileCode className="h-5 w-5 text-indigo-600 group-hover:text-white" />
                        </div>
                        <div>
                           <h4 className="text-sm font-black uppercase tracking-tight text-slate-900 italic line-clamp-1">{snippet.title}</h4>
                           <span className="text-[9px] font-black uppercase tracking-widest text-indigo-500">{snippet.language}</span>
                        </div>
                     </div>
                     <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                        <button 
                          onClick={() => handleOpenEditor(snippet)}
                          className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-900 transition-colors"
                        >
                           <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button 
                          onClick={() => handleDelete(snippet.id)}
                          className="p-2 hover:bg-rose-50 rounded-lg text-slate-400 hover:text-rose-600 transition-colors"
                        >
                           <Trash2 className="h-3.5 w-3.5" />
                        </button>
                     </div>
                  </div>

                  <p className="text-[10px] font-medium text-slate-500 leading-relaxed line-clamp-2">{snippet.description}</p>
                  
                  <div className="relative rounded-2xl bg-slate-950 p-4 font-mono text-[11px] text-slate-300 overflow-hidden group/code">
                     <div className="max-h-32 overflow-hidden mask-fade-bottom">
                        <pre className="whitespace-pre-wrap break-all leading-tight">{snippet.code}</pre>
                     </div>
                     <button 
                        onClick={() => handleCopyCode(snippet.code)}
                        className="absolute right-3 top-3 p-2 bg-white/10 hover:bg-white/20 rounded-lg text-white opacity-0 group-hover/code:opacity-100 transition-all active:scale-90"
                     >
                        <Copy className="h-3.5 w-3.5" />
                     </button>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                     {snippet.tags.map(tag => (
                        <span key={tag} className="text-[8px] font-black uppercase tracking-widest px-2.5 py-1 bg-slate-50 text-slate-400 rounded-lg border border-slate-100 flex items-center gap-1">
                           <Tag className="h-2 w-2" /> {tag}
                        </span>
                     ))}
                  </div>
               </div>
            </div>
          ))
        )}
      </div>

      {/* SNIPPET EDITOR MODAL */}
      <Dialog open={isEditorOpen} onOpenChange={setIsEditorOpen}>
        <DialogContent className="max-w-[95vw] md:max-w-[1000px] rounded-[2.5rem] border-none shadow-2xl p-0 overflow-hidden bg-white">
          <DialogHeader className="p-8 pb-4 border-b border-slate-100 bg-slate-900 text-white">
            <DialogTitle className="text-2xl font-black font-headline uppercase tracking-tighter italic text-white">
              {editingSnippet ? 'Ajustar' : 'Novo'} <span className="text-indigo-500 not-italic">Snippet</span>
            </DialogTitle>
          </DialogHeader>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 p-8">
            <div className="space-y-6">
               <div className="space-y-2">
                 <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Título do Snippet</Label>
                 <Input 
                   value={formData.title} 
                   onChange={e => setFormData({...formData, title: e.target.value})}
                   placeholder="Ex: API Fetch Wrapper"
                   className="h-12 rounded-xl font-bold border-2 border-slate-100 focus:border-indigo-500/20"
                 />
               </div>

               <div className="space-y-2">
                 <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Descrição</Label>
                 <Textarea 
                   value={formData.description} 
                   onChange={e => setFormData({...formData, description: e.target.value})}
                   placeholder="Para que serve este código?"
                   className="min-h-[80px] rounded-xl text-sm border-2 border-slate-100 focus:border-indigo-500/20"
                 />
               </div>

               <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Linguagem</Label>
                    <select 
                      value={formData.language}
                      onChange={e => setFormData({...formData, language: e.target.value})}
                      className="w-full h-11 rounded-xl border-2 border-slate-100 bg-white font-bold text-xs px-3 focus:border-indigo-500/20 outline-none"
                    >
                      {LANGUAGES.map(lang => (
                        <option key={lang} value={lang}>{lang.toUpperCase()}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Tags (separadas por vírgula)</Label>
                    <Input 
                      value={formData.tags} 
                      onChange={e => setFormData({...formData, tags: e.target.value})}
                      placeholder="React, Hook, Auth"
                      className="h-11 rounded-xl font-bold border-2 border-slate-100 focus:border-indigo-500/20"
                    />
                  </div>
               </div>
            </div>

             <div className="space-y-2 flex flex-col h-[400px] md:h-auto min-h-[400px]">
               <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1 flex justify-between">
                 Código Fonte
                 <span className="text-indigo-600 animate-pulse">● Editor Monaco Ativo</span>
               </Label>
               <div className="flex-1 rounded-xl overflow-hidden border-2 border-slate-100 bg-slate-950 p-2">
                 <Editor
                   height="100%"
                   language={formData.language}
                   theme="vs-dark"
                   value={formData.code}
                   onChange={(value) => setFormData({ ...formData, code: value || '' })}
                   options={{
                     minimap: { enabled: false },
                     fontSize: 12,
                     fontFamily: 'JetBrains Mono, Menlo, Monaco, Courier New, monospace',
                     scrollBeyondLastLine: false,
                     automaticLayout: true,
                     padding: { top: 16, bottom: 16 },
                     lineNumbers: 'on',
                     glyphMargin: false,
                     folding: true,
                     lineDecorationsWidth: 0,
                     lineNumbersMinChars: 3,
                     renderLineHighlight: 'all',
                     scrollbar: {
                       vertical: 'hidden',
                       horizontal: 'hidden'
                     }
                   }}
                   loading={
                     <div className="flex items-center justify-center h-full text-slate-500 gap-2">
                       <Loader2 className="h-4 w-4 animate-spin" />
                       <span className="text-[10px] font-black uppercase tracking-widest">Carregando Editor...</span>
                     </div>
                   }
                 />
               </div>
             </div>

          </div>

          <DialogFooter className="p-8 bg-slate-50 border-t border-slate-100">
            <Button variant="ghost" onClick={() => setIsEditorOpen(false)} className="font-black text-[10px] uppercase tracking-widest">Cancelar</Button>
            <Button 
              onClick={handleSave} 
              disabled={!formData.title.trim() || !formData.code.trim()} 
              className="h-12 px-8 font-black text-[10px] uppercase tracking-widest rounded-xl bg-indigo-600 text-white shadow-xl shadow-indigo-500/20 hover:bg-indigo-700"
            >
              Salvar Snippet
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <style jsx global>{`
        .mask-fade-bottom {
          mask-image: linear-gradient(to bottom, black 70%, transparent 100%);
        }
      `}</style>
    </div>
  );
}

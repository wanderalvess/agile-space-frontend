'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ExternalLink, 
  Plus, 
  Globe, 
  Github, 
  Figma, 
  Trello, 
  Layout,
  Trash2,
  Link2,
  Book,
  Code2,
  Briefcase
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter,
  DialogTrigger 
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
interface QuickLinkData {
  id: string;
  name: string;
  url: string;
  iconType: string;
  color: string;
}

interface QuickLinksProps {
  links: QuickLinkData[];
  onAddLink: (name: string, url: string, iconType: string, color: string) => void;
  onDeleteLink: (id: string) => void;
}

const ICON_MAP: Record<string, any> = {
  globe: Globe,
  github: Github,
  figma: Figma,
  trello: Trello,
  layout: Layout,
  book: Book,
  code: Code2,
  briefcase: Briefcase,
  link: Link2
};

const COLOR_PRESETS = [
  { name: 'Blue', class: 'text-blue-500 bg-blue-50' },
  { name: 'Green', class: 'text-emerald-500 bg-emerald-50' },
  { name: 'Purple', class: 'text-purple-500 bg-purple-50' },
  { name: 'Orange', class: 'text-orange-500 bg-orange-50' },
  { name: 'Slate', class: 'text-slate-900 bg-slate-100' },
];

export function QuickLinks({ links, onAddLink, onDeleteLink }: QuickLinksProps) {
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newUrl, setNewUrl] = useState('');
  const [selectedIcon, setSelectedIcon] = useState('globe');
  const [selectedColor, setSelectedColor] = useState(COLOR_PRESETS[0].class);

  const handleAddLink = () => {
    if (!newName || !newUrl) return;
    
    const url = newUrl.startsWith('http') ? newUrl : `https://${newUrl}`;
    
    onAddLink(newName, url, selectedIcon, selectedColor);

    setNewName('');
    setNewUrl('');
    setIsAddOpen(false);
  };

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    onDeleteLink(id);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex flex-col">
           <h3 className="text-xl font-black uppercase tracking-tighter italic text-slate-900">Meus <span className="text-primary not-italic">Atalhos</span></h3>
           <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Links rápidos da sua squad</span>
        </div>
        
        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger asChild>
            <Button className="h-10 px-6 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest gap-2 shadow-lg shadow-slate-900/10 active:scale-95 transition-all">
              <Plus className="h-4 w-4" /> Novo Link
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px] rounded-[2.5rem] border-none bg-white/95 backdrop-blur-xl shadow-2xl">
            <DialogHeader>
              <DialogTitle className="text-2xl font-black uppercase tracking-tighter italic text-slate-900">Adicionar <span className="text-primary not-italic">Atalho</span></DialogTitle>
            </DialogHeader>
            <div className="grid gap-6 py-4">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Nome do Atalho</Label>
                <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Ex: Jira Board" className="h-12 rounded-xl font-bold border-2" />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">URL (Endereço)</Label>
                <Input value={newUrl} onChange={(e) => setNewUrl(e.target.value)} placeholder="Ex: jira.com/squad-x" className="h-12 rounded-xl font-bold border-2" />
              </div>
              
              <div className="space-y-3">
                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Ícone e Cor</Label>
                <div className="flex flex-wrap gap-2 p-3 bg-slate-50 rounded-2xl border border-slate-100">
                  {Object.entries(ICON_MAP).map(([key, Icon]) => (
                    <button
                      key={key}
                      onClick={() => setSelectedIcon(key)}
                      className={cn(
                        "w-10 h-10 rounded-xl flex items-center justify-center transition-all",
                        selectedIcon === key ? "bg-primary text-white scale-110 shadow-lg" : "bg-white text-slate-400 hover:text-slate-600 border border-slate-200"
                      )}
                    >
                      <Icon className="h-5 w-5" />
                    </button>
                  ))}
                </div>
                <div className="flex gap-2 p-3 bg-slate-50 rounded-2xl border border-slate-100">
                  {COLOR_PRESETS.map((color) => (
                    <button
                      key={color.name}
                      onClick={() => setSelectedColor(color.class)}
                      className={cn(
                        "w-8 h-8 rounded-full border-4 transition-all",
                        selectedColor === color.class ? "border-primary scale-110 shadow-lg" : "border-white",
                        color.class.split(' ')[1]
                      )}
                    />
                  ))}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleAddLink} className="w-full h-12 bg-primary text-white rounded-2xl font-black uppercase tracking-widest text-[11px] shadow-xl shadow-primary/20">
                Salvar Atalho
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
        {links.length > 0 ? (
          links.map((link) => {
            const Icon = ICON_MAP[link.iconType] || Link2;
            return (
              <motion.a
                key={link.id}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                whileHover={{ y: -5, scale: 1.02 }}
                className="relative group flex items-center gap-4 p-5 bg-white border border-slate-100 rounded-[2rem] transition-all hover:border-primary/40 hover:shadow-2xl hover:shadow-primary/5"
              >
                <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-110", link.color)}>
                  <Icon className="h-7 w-7" />
                </div>
                <div className="flex flex-col min-w-0">
                   <span className="text-sm font-black text-slate-800 truncate leading-tight tracking-tight">{link.name}</span>
                   <div className="flex items-center gap-1.5 mt-1">
                      <span className="text-[8px] font-black uppercase tracking-widest text-primary opacity-60">Acessar</span>
                      <ExternalLink className="h-2.5 w-2.5 text-primary opacity-60" />
                   </div>
                </div>
                
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={(e) => handleDelete(e, link.id)}
                  className="absolute top-4 right-4 h-8 w-8 rounded-xl opacity-0 group-hover:opacity-100 bg-red-50 text-red-400 hover:text-red-600 hover:bg-red-100 transition-all active:scale-90"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </motion.a>
            );
          })
        ) : (
          <div className="col-span-full py-20 bg-slate-50/50 rounded-[3rem] border-2 border-dashed border-slate-200 flex flex-col items-center justify-center space-y-4 opacity-40">
             <Link2 className="h-10 w-10" />
             <p className="text-[10px] font-black uppercase tracking-widest">Nenhum atalho configurado</p>
          </div>
        )}
      </div>
    </div>
  );
}

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
import { WorkspaceSectionHeader } from './WorkspaceSectionHeader';
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
    <div className="w-full space-y-6">
      <WorkspaceSectionHeader
        kicker="Atalhos"
        accent="orange"
        title="Meus"
        titleAccent="Atalhos"
        subtitle="Links rápidos da sua squad"
        action={
          <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
            <DialogTrigger asChild>
              <Button className="h-10 px-6 bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs uppercase tracking-wider rounded-xl shadow-md shadow-primary/20 gap-2 active:scale-95 transition-all">
                <Plus className="h-4 w-4" /> Novo Link
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[460px] rounded-3xl border border-border bg-card text-card-foreground shadow-2xl p-6">
              <DialogHeader>
                <DialogTitle className="text-xl font-black font-headline uppercase tracking-tight italic text-foreground">
                  Adicionar <span className="text-primary not-italic">Atalho</span>
                </DialogTitle>
              </DialogHeader>
              <div className="grid gap-5 py-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground ml-1">Nome do Atalho</Label>
                  <Input 
                    value={newName} 
                    onChange={(e) => setNewName(e.target.value)} 
                    placeholder="Ex: Jira Board da Squad" 
                    className="h-11 rounded-xl font-medium border-border bg-background focus-visible:ring-primary/20" 
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground ml-1">URL (Endereço)</Label>
                  <Input 
                    value={newUrl} 
                    onChange={(e) => setNewUrl(e.target.value)} 
                    placeholder="Ex: jira.suaempresa.com/board" 
                    className="h-11 rounded-xl font-medium border-border bg-background focus-visible:ring-primary/20" 
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground ml-1">Ícone</Label>
                  <div className="flex flex-wrap gap-2 p-3 bg-muted/40 rounded-2xl border border-border/60">
                    {Object.entries(ICON_MAP).map(([key, Icon]) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setSelectedIcon(key)}
                        className={cn(
                          "w-9 h-9 rounded-xl flex items-center justify-center transition-all",
                          selectedIcon === key ? "bg-primary text-primary-foreground scale-105 shadow-xs" : "bg-card text-muted-foreground hover:text-foreground border border-border/60"
                        )}
                      >
                        <Icon className="h-4 w-4" />
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground ml-1">Cor de Destaque</Label>
                  <div className="flex gap-3 p-3 bg-muted/40 rounded-2xl border border-border/60">
                    {COLOR_PRESETS.map((color) => (
                      <button
                        key={color.name}
                        type="button"
                        onClick={() => setSelectedColor(color.class)}
                        className={cn(
                          "w-7 h-7 rounded-full border-2 transition-all",
                          selectedColor === color.class ? "border-primary scale-110 shadow-xs ring-2 ring-primary/20" : "border-border/60",
                          color.class.split(' ')[1]
                        )}
                      />
                    ))}
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button 
                  onClick={handleAddLink} 
                  disabled={!newName.trim() || !newUrl.trim()}
                  className="w-full h-11 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl font-bold text-xs uppercase tracking-wider shadow-md shadow-primary/20"
                >
                  Salvar Atalho
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-4">
        {links.length > 0 ? (
          links.map((link) => {
            const Icon = ICON_MAP[link.iconType] || Link2;
            return (
              <motion.a
                key={link.id}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                whileHover={{ y: -2 }}
                className="relative group flex items-center gap-3.5 p-4 bg-card text-card-foreground border border-border/80 rounded-2xl transition-all hover:border-primary/40 hover:shadow-md shadow-xs"
              >
                <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-105", link.color)}>
                  <Icon className="h-6 w-6" />
                </div>
                <div className="flex flex-col min-w-0 pr-6">
                   <span className="text-xs font-bold text-foreground truncate leading-tight tracking-tight group-hover:text-primary transition-colors">
                     {link.name}
                   </span>
                   <div className="flex items-center gap-1 mt-1 text-[10px] font-bold uppercase tracking-wider text-primary">
                      <span>Acessar</span>
                      <ExternalLink className="h-3 w-3" />
                   </div>
                </div>
                
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={(e) => handleDelete(e, link.id)}
                  className="absolute top-3 right-3 h-7 w-7 rounded-lg opacity-0 group-hover:opacity-100 bg-destructive/10 text-destructive hover:bg-destructive/20 transition-all active:scale-90"
                  title="Excluir atalho"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </motion.a>
            );
          })
        ) : (
          <div className="col-span-full py-16 bg-muted/20 rounded-3xl border border-dashed border-border/80 flex flex-col items-center justify-center space-y-3 text-muted-foreground">
             <Link2 className="h-8 w-8 opacity-50" />
             <p className="text-xs font-bold uppercase tracking-wider">Nenhum atalho configurado</p>
          </div>
        )}
      </div>
    </div>
  );
}

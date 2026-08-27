'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { 
  PartyPopper, 
  Plus, 
  Trash2, 
  RotateCcw, 
  CalendarDays, 
  Users, 
  Upload, 
  Eraser, 
  List,
  Info,
  Check,
  HeartPulse,
  Code
} from 'lucide-react';
import { AgileSpinner } from '@/components/ui/AgileSpinner';
import { DEFAULT_HEALTH_CHECK_DIMENSIONS } from '@/lib/health-check-defaults';
import { HealthCheckDimension, HealthCheckScaleType } from '@/lib/types';
import { HEALTH_CHECK_TEMPLATES } from '@/lib/health-check-templates';
import { ScrollArea } from '../ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from '../ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { Card } from '../ui/card';
import { cn } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';
import { useUserContext } from '@/context/UserContext';
import { Badge } from '@/components/ui/badge';

interface CreateHealthCheckDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreateBoard: (dimensions: HealthCheckDimension[], sprintName: string, team: string, scaleType: HealthCheckScaleType) => void;
  isCreating: boolean;
}

const CUSTOM_DIMENSIONS_KEY = 'custom-health-check-dimensions';

export function CreateHealthCheckDialog({ open, onOpenChange, onCreateBoard, isCreating }: CreateHealthCheckDialogProps) {
  const { toast } = useToast();
  const { userProfile } = useUserContext();
  
  // Basic Info
  const [sprintName, setSprintName] = useState('');
  const [teamName, setTeamName] = useState('');
  
  // Dimensions Management
  const [dimensions, setDimensions] = useState<HealthCheckDimension[]>([]);
  const [scaleType, setScaleType] = useState<HealthCheckScaleType>('traffic_light');
  const [saveAsDefault, setSaveAsDefault] = useState(false);
  
  // Import Mode
  const [isImportMode, setIsImportMode] = useState(false);
  const [bulkText, setBulkText] = useState('');

  // Quick Add State
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');

  useEffect(() => {
    if (open) {
      if (userProfile?.team && !teamName) setTeamName(userProfile.team);
      
      // Load dimensions
      try {
        const stored = localStorage.getItem(CUSTOM_DIMENSIONS_KEY);
        if (stored) {
          setDimensions(JSON.parse(stored));
        } else {
          setDimensions(DEFAULT_HEALTH_CHECK_DIMENSIONS);
        }
      } catch (e) {
        setDimensions(DEFAULT_HEALTH_CHECK_DIMENSIONS);
      }
    }
  }, [open, userProfile]);

  const handleDimensionChange = (index: number, field: 'title' | 'description', value: string) => {
    const newDimensions = [...dimensions];
    newDimensions[index] = { ...newDimensions[index], [field]: value };
    setDimensions(newDimensions);
  };

  const handleQuickAdd = () => {
    if (!newTitle.trim()) return;
    const newKey = `custom-${Date.now()}`;
    setDimensions([...dimensions, { key: newKey, title: newTitle.trim(), description: newDesc.trim() }]);
    setNewTitle('');
    setNewDesc('');
  };

  const handleBulkImport = () => {
    const lines = bulkText.split('\n').filter(l => l.trim() !== '');
    if (lines.length === 0) {
      setIsImportMode(false);
      return;
    }

    const imported = lines.map(line => {
      const separators = [' - ', ': ', ' – ', ' — '];
      let title = line.trim();
      let description = '';

      for (const sep of separators) {
        if (line.includes(sep)) {
          const parts = line.split(sep);
          title = parts[0].trim();
          description = parts.slice(1).join(sep).trim();
          break;
        }
      }

      return {
        key: `import-${Math.random().toString(36).substr(2, 9)}`,
        title,
        description
      };
    });

    setDimensions([...dimensions, ...imported]);
    setBulkText('');
    setIsImportMode(false);
    toast({ title: "Dimensões importadas!" });
  };

  const handleRemoveDimension = (key: string) => {
    setDimensions(dimensions.filter(d => d.key !== key));
  };

  const handleResetToDefault = () => {
    setDimensions(DEFAULT_HEALTH_CHECK_DIMENSIONS);
    setScaleType('traffic_light');
    localStorage.removeItem(CUSTOM_DIMENSIONS_KEY);
    toast({ title: "Padrão Spotify restaurado" });
  };

  const handleTemplateSelect = (templateId: string) => {
    if (templateId === 'custom') return;
    const template = HEALTH_CHECK_TEMPLATES.find(t => t.id === templateId);
    if (template) {
      setDimensions(template.dimensions);
      setScaleType(template.defaultScale);
      toast({ title: `Template ${template.name} carregado!` });
    }
  };

  const handleSubmit = () => {
    const validDimensions = dimensions.filter(d => d.title.trim() !== '');
    if (validDimensions.length === 0) {
      toast({ title: "Adicione pelo menos uma dimensão", variant: "destructive" });
      return;
    }
    if (!sprintName.trim()) {
      toast({ title: "Informe o título da cerimônia", variant: "destructive" });
      return;
    }

    if (saveAsDefault) {
      localStorage.setItem(CUSTOM_DIMENSIONS_KEY, JSON.stringify(validDimensions));
    }
    
    onCreateBoard(validDimensions, sprintName.trim(), teamName.trim() || 'Squad Geral', scaleType);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl rounded-[3rem] border-none shadow-2xl p-0 overflow-hidden bg-white/95 backdrop-blur-xl">
        <div className="p-8 pb-4">
          <DialogHeader>
            <div className="flex items-center gap-4 mb-4">
              <div className="w-14 h-14 bg-rose-600 rounded-2xl flex items-center justify-center shadow-lg shadow-rose-500/30 shrink-0 rotate-3 transition-transform hover:rotate-0">
                <HeartPulse className="h-8 w-8 text-white" />
              </div>
              <div>
                <DialogTitle className="text-3xl font-black uppercase tracking-tighter italic text-slate-800 leading-none">
                  Configurações <span className="text-rose-600">Radar de Saúde</span>
                </DialogTitle>
                <DialogDescription className="text-[11px] font-black uppercase text-slate-500 tracking-[0.2em] mt-2">
                  Diagnóstico anônimo e seguro para squads de alta performance.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
        </div>

        <div className="max-h-[55vh] px-8">
          <ScrollArea className="h-full pr-4">
            <div className="space-y-8 py-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <Label className="text-[11px] font-black uppercase tracking-[0.3em] text-slate-600 pl-1">Modelo / Template</Label>
                  <Select onValueChange={handleTemplateSelect}>
                    <SelectTrigger className="h-14 font-bold rounded-2xl border-none bg-slate-100/50 hover:bg-slate-100 focus:bg-white transition-all shadow-inner text-slate-900">
                      <SelectValue placeholder="Selecione um Modelo..." />
                    </SelectTrigger>
                    <SelectContent className="rounded-2xl font-bold border-none shadow-2xl">
                       <SelectItem value="custom" disabled className="text-[10px] uppercase font-black tracking-widest text-slate-400 py-3">Templates Prontos</SelectItem>
                       {HEALTH_CHECK_TEMPLATES.map(t => (
                         <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                       ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-3">
                  <Label className="text-[11px] font-black uppercase tracking-[0.3em] text-slate-600 pl-1">Escala de Resposta</Label>
                  <Select value={scaleType} onValueChange={(val: any) => setScaleType(val)}>
                    <SelectTrigger className="h-14 font-bold rounded-2xl border-none bg-slate-100/50 hover:bg-slate-100 focus:bg-white transition-all shadow-inner text-slate-900">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-2xl font-bold border-none shadow-2xl">
                       <SelectItem value="traffic_light">🚥 Semáforo (Verde, Amarelo, Vermelho)</SelectItem>
                       <SelectItem value="numbers_5">🔢 Numérico (Escala 1 a 5)</SelectItem>
                       <SelectItem value="emojis">🙂 Emocional (Satisfeito, Médio, Triste)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Separator className="bg-slate-100" />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <Label className="text-[11px] font-black uppercase tracking-[0.3em] text-slate-600 pl-1">Título da Cerimônia</Label>
                  <div className="relative group">
                    <CalendarDays className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-rose-600 group-focus-within:scale-110 transition-transform" />
                    <Input 
                      value={sprintName}
                      onChange={(e) => setSprintName(e.target.value)}
                      placeholder="Ex: Radar Sprint 45"
                      className="pl-12 h-14 font-bold rounded-2xl border-none bg-slate-100/50 hover:bg-slate-100 focus:bg-white transition-all shadow-inner text-slate-900 placeholder:text-slate-400"
                    />
                  </div>
                </div>
                <div className="space-y-3">
                  <Label className="text-[11px] font-black uppercase tracking-[0.3em] text-slate-600 pl-1">Squad / Time</Label>
                  <div className="relative group">
                    <Users className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-rose-600 group-focus-within:scale-110 transition-transform" />
                    <Input 
                      value={teamName}
                      onChange={(e) => setTeamName(e.target.value)}
                      placeholder="Ex: Squad Thor"
                      className="pl-12 h-14 font-bold rounded-2xl border-none bg-slate-100/50 hover:bg-slate-100 focus:bg-white transition-all shadow-inner text-slate-900 placeholder:text-slate-400"
                    />
                  </div>
                </div>
              </div>

              <div className="h-px bg-slate-100" />

              {/* Gerenciamento de Dimensões */}
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-rose-50 rounded-xl">
                      <List className="h-4 w-4 text-rose-600" />
                    </div>
                    <Label className="text-[11px] font-black uppercase tracking-[0.3em] text-slate-800">Dimensões de Avaliação</Label>
                    <Badge className="bg-rose-600 text-white border-none h-6 px-3 text-[10px] font-black uppercase rounded-lg shadow-lg shadow-rose-500/20">{dimensions.length}</Badge>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => setIsImportMode(!isImportMode)} 
                      className="h-10 text-[10px] font-black uppercase tracking-widest gap-2 hover:bg-rose-50 hover:text-rose-600 rounded-xl transition-all"
                    >
                      {isImportMode ? <List className="h-4 w-4" /> : <Upload className="h-4 w-4" />}
                      {isImportMode ? 'Visualizar' : 'Importar'}
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => setDimensions([])} 
                      className="h-10 text-[10px] font-black uppercase tracking-widest text-rose-500 hover:bg-rose-50 rounded-xl transition-all gap-2"
                    >
                      <Eraser className="h-4 w-4" />
                      Limpar
                    </Button>
                  </div>
                </div>

                {isImportMode ? (
                  <div className="space-y-4 animate-in fade-in slide-in-from-top-4 duration-500">
                    <div className="bg-slate-900 p-5 rounded-3xl border border-slate-800 shadow-2xl relative overflow-hidden group">
                      <div className="absolute top-0 right-0 p-4 opacity-10">
                        <Code className="h-12 w-12 text-white" />
                      </div>
                      <div className="flex gap-4 items-start relative z-10">
                        <Info className="h-5 w-5 text-rose-400 shrink-0 mt-0.5" />
                        <p className="text-[10px] font-bold text-slate-400 uppercase leading-relaxed tracking-wider">
                          Cole uma dimensão por linha.<br/>
                          Use <span className="text-rose-400">"-"</span> para separar título de descrição.<br/>
                          Ex: <span className="text-white">Autonomia - Temos poder de decisão?</span>
                        </p>
                      </div>
                    </div>
                    <Textarea 
                      value={bulkText}
                      onChange={(e) => setBulkText(e.target.value)}
                      placeholder="Dimensão 1 - Descrição..."
                      className="min-h-[250px] font-mono text-xs rounded-[2rem] bg-slate-50 border-none shadow-inner focus-visible:ring-rose-500/20 p-8 leading-relaxed"
                    />
                    <Button onClick={handleBulkImport} className="w-full h-14 font-black text-[11px] uppercase tracking-[0.3em] bg-slate-900 rounded-2xl hover:bg-black transition-all shadow-xl shadow-slate-200">
                      Processar Importação em Massa
                    </Button>
                  </div>
                ) : (
                  <div className="grid gap-4">
                    {dimensions.map((dim, index) => (
                      <Card key={dim.key} className="group relative border border-slate-100 bg-slate-50/50 p-6 transition-all duration-300 hover:bg-white hover:shadow-2xl hover:shadow-rose-500/5 rounded-[2.5rem]">
                        <div className="flex items-start gap-5">
                          <div className="w-12 h-12 rounded-2xl bg-white shadow-sm flex items-center justify-center shrink-0 text-slate-400 group-hover:text-rose-600 group-hover:bg-rose-50 transition-all font-black italic text-sm border border-slate-100">
                            {index + 1}
                          </div>
                          <div className="flex-1 space-y-2 pt-1">
                            <Input
                              value={dim.title}
                              onChange={(e) => handleDimensionChange(index, 'title', e.target.value)}
                              placeholder="Título da dimensão"
                              className="font-black border-none shadow-none focus-visible:ring-0 p-0 text-xl h-auto bg-transparent uppercase tracking-tight text-slate-800 placeholder:text-slate-300"
                            />
                            <Input
                              value={dim.description}
                              onChange={(e) => handleDimensionChange(index, 'description', e.target.value)}
                              placeholder="Descrição curta para guiar o time"
                              className="text-[11px] font-bold uppercase tracking-[0.15em] text-slate-500 border-none shadow-none focus-visible:ring-0 p-0 h-auto bg-transparent placeholder:text-slate-400"
                            />
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemoveDimension(dim.key)}
                          className="text-slate-300 hover:text-rose-500 hover:bg-rose-50 shrink-0 opacity-0 group-hover:opacity-100 transition-all h-12 w-12 absolute right-6 top-1/2 -translate-y-1/2 rounded-2xl"
                        >
                          <Trash2 className="h-5 w-5" />
                        </Button>
                      </Card>
                    ))}

                    {/* Adição Rápida */}
                    <div className="p-8 border-2 border-dashed border-slate-200 rounded-[3rem] bg-rose-50/30 flex flex-col sm:flex-row gap-6 group hover:border-rose-300 transition-all">
                      <div className="flex-1 space-y-4">
                        <Input 
                          placeholder="Nova Dimensão (ex: Missão)" 
                          value={newTitle}
                          onChange={(e) => setNewTitle(e.target.value)}
                          className="h-12 text-xs font-black uppercase tracking-tight bg-white border-none rounded-2xl shadow-sm px-6 placeholder:text-slate-400 text-slate-900"
                        />
                        <Input 
                          placeholder="O time sabe para onde está indo?" 
                          value={newDesc}
                          onChange={(e) => setNewDesc(e.target.value)}
                          className="h-12 text-[11px] font-bold uppercase tracking-[0.2em] bg-white border-none rounded-2xl shadow-sm px-6 placeholder:text-slate-300 text-slate-600"
                        />
                      </div>
                      <Button onClick={handleQuickAdd} disabled={!newTitle.trim()} size="icon" className="h-auto aspect-square w-full sm:w-24 rounded-[2rem] bg-rose-600 hover:bg-rose-700 shadow-lg shadow-rose-500/20 active:scale-90 transition-all shrink-0">
                        <Plus className="h-10 w-10 text-white" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              {!isImportMode && (
                <div className="flex justify-center pt-2">
                  <Button variant="ghost" onClick={handleResetToDefault} className="h-10 text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl px-8 transition-all">
                    <RotateCcw className="mr-3 h-4 w-4" />
                    Restaurar Dimensões Originais
                  </Button>
                </div>
              )}
            </div>
          </ScrollArea>
        </div>

        <div className="p-8 pt-4">
          <DialogFooter className="flex-col sm:flex-row gap-8 items-center">
            <div className="flex items-center space-x-4 mr-auto group cursor-pointer" onClick={() => setSaveAsDefault(!saveAsDefault)}>
              <Checkbox 
                id="save-default" 
                checked={saveAsDefault} 
                onCheckedChange={(checked) => setSaveAsDefault(checked === true)} 
                className="w-6 h-6 rounded-lg border-2 border-slate-200 data-[state=checked]:bg-rose-600 data-[state=checked]:border-none transition-all"
              />
              <Label htmlFor="save-default" className="text-[11px] font-black text-slate-400 uppercase tracking-[0.1em] cursor-pointer group-hover:text-slate-600 transition-colors">
                Salvar preferências como meu padrão
              </Label>
            </div>
            <div className="flex gap-4 w-full sm:w-auto">
              <Button variant="ghost" onClick={() => onOpenChange(false)} className="h-16 px-10 font-black uppercase text-[12px] tracking-widest rounded-2xl hover:bg-slate-100 hover:text-slate-900 transition-all">Cancelar</Button>
              <Button onClick={handleSubmit} disabled={isCreating || dimensions.length === 0} className="h-16 px-12 bg-rose-600 hover:bg-rose-700 font-black uppercase tracking-[0.3em] text-[12px] shadow-2xl shadow-rose-600/30 rounded-2xl active:scale-95 transition-all text-white flex-1 sm:flex-initial">
                {isCreating ? <AgileSpinner size="sm" variant="white" className="mr-3" /> : <PartyPopper className="mr-3 h-6 w-6" />}
                {isCreating ? 'Sincronizando...' : 'Lançar Radar'}
              </Button>
            </div>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}

'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Copy, Check, FileText, DownloadCloud, Image as ImageIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from '@/lib/utils';

interface EliteExportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description: string;
  markdownContent: string;
  onDownloadCSV?: () => void;
  onExportImage?: () => void;
  theme?: 'primary' | 'amber' | 'emerald' | 'rose';
}

const THEME_STYLES = {
  primary: {
    bgId: 'bg-primary/10',
    textId: 'text-primary',
    hoverBg: 'hover:bg-primary/5',
    border: 'border-primary/20',
    btnBg: 'bg-primary',
    btnHover: 'hover:bg-orange-600',
    shadow: 'shadow-primary/20',
  },
  amber: {
    bgId: 'bg-amber-500/10',
    textId: 'text-amber-600',
    hoverBg: 'hover:bg-amber-50',
    border: 'border-amber-500/20',
    btnBg: 'bg-amber-500',
    btnHover: 'hover:bg-amber-600',
    shadow: 'shadow-amber-200',
  },
  emerald: {
    bgId: 'bg-emerald-500/10',
    textId: 'text-emerald-600',
    hoverBg: 'hover:bg-emerald-50',
    border: 'border-emerald-500/20',
    btnBg: 'bg-emerald-500',
    btnHover: 'hover:bg-emerald-600',
    shadow: 'shadow-emerald-200',
  },
  rose: {
    bgId: 'bg-rose-500/10',
    textId: 'text-rose-600',
    hoverBg: 'hover:bg-rose-50',
    border: 'border-rose-500/20',
    btnBg: 'bg-rose-500',
    btnHover: 'hover:bg-rose-600',
    shadow: 'shadow-rose-200',
  }
};

export function EliteExportDialog({ 
  isOpen, 
  onClose, 
  title,
  description,
  markdownContent,
  onDownloadCSV,
  onExportImage,
  theme = 'primary'
}: EliteExportDialogProps) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  
  const styles = THEME_STYLES[theme];

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(markdownContent);
      setCopied(true);
      toast({
        title: "Resumo copiado!",
        description: "Cole no Slack, Teams ou Confluence.",
      });
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast({
        title: "Erro ao copiar",
        description: "Ocorreu um erro ao copiar para a área de transferência.",
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col p-0 border-none bg-card shadow-2xl rounded-2xl">
        <DialogHeader className="p-6 pb-2 border-b border-border/50 bg-muted/20">
          <div className="flex items-center gap-3 mb-1">
             <div className={cn("p-2 rounded-lg", styles.bgId)}>
                <FileText className={cn("h-5 w-5", styles.textId)} />
             </div>
             <div>
                <DialogTitle className="text-xl font-black uppercase tracking-tight">{title}</DialogTitle>
                <DialogDescription className="text-xs font-medium text-muted-foreground">
                  {description}
                </DialogDescription>
             </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-6 bg-muted/5 font-mono text-[11px] leading-relaxed select-all">
          <pre className="whitespace-pre-wrap break-words bg-background/50 p-4 rounded-xl border border-border/50 shadow-inner">
            {markdownContent}
          </pre>
        </div>

        <DialogFooter className="p-6 pt-2 border-t border-border/50 bg-muted/20 gap-3">
          <Button variant="ghost" onClick={onClose} className="h-10 px-6 text-xs font-black uppercase">
            Fechar
          </Button>

          {onDownloadCSV && (
            <Button 
              variant="outline"
              onClick={onDownloadCSV} 
              className={cn("h-10 gap-2 text-[10px] font-black uppercase tracking-tight transition-all", styles.hoverBg, styles.border, styles.textId)}
            >
              <DownloadCloud className="h-4 w-4" />
              CSV (Excel)
            </Button>
          )}

          {onExportImage && (
            <Button 
              variant="outline"
              onClick={() => {
                onClose();
                setTimeout(onExportImage, 300);
              }} 
              className={cn("h-10 gap-2 text-[10px] font-black uppercase tracking-tight transition-all", styles.hoverBg, styles.border, styles.textId)}
            >
              <ImageIcon className="h-4 w-4" />
              Salvar Imagem
            </Button>
          )}

          <Button 
            onClick={handleCopy} 
            className={cn("flex-1 h-10 gap-2 text-xs font-black uppercase tracking-widest text-white shadow-lg transition-all hover:scale-[1.02]", styles.btnBg, styles.btnHover, styles.shadow)}
          >
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copied ? "Copiado!" : "Copiar Resumo"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

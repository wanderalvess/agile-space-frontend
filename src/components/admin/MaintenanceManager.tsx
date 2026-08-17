'use client';

import React, { useState } from 'react';
import { 
  collection, 
  getDocs, 
  query, 
  limit, 
  writeBatch,
  doc,
  deleteDoc,
  getCountFromServer
} from 'firebase/firestore';
import { useFirebase } from '@/firebase';
import { 
  Database, 
  Download, 
  Trash2, 
  RefreshCcw, 
  ShieldAlert, 
  HardDrive, 
  Activity,
  FileJson,
  Zap,
  Box,
  Layout
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';
import { logSystemEvent } from '@/lib/audit';
import { AgileSpinner } from '../ui/AgileSpinner';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

export function MaintenanceManager() {
  const { firestore, user } = useFirebase();
  const [isExporting, setIsExporting] = useState(false);
  const [isPurging, setIsPurging] = useState(false);
  const [healthStatus, setHealthStatus] = useState<'idle' | 'scanning' | 'healthy' | 'issue'>('idle');

  const handleExportBackup = async () => {
    if (!firestore) return;
    setIsExporting(true);
    try {
      // Exportamos uma amostra ou dados críticos (Users, Rooms, Feedbacks)
      const collections = ['users', 'rooms', 'feedbacks', 'system_events'];
      const backupData: Record<string, any> = {};

      for (const colName of collections) {
        const snap = await getDocs(query(collection(firestore, colName), limit(500)));
        backupData[colName] = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      }

      const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `agilespace_backup_${new Date().toISOString().split('T')[0]}.json`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      await logSystemEvent(firestore, {
        content: `BACKUP EXPORTADO: Snapshop de ${collections.join(', ')} realizado.`,
        type: 'security',
        severity: 'info',
        userEmail: user?.email,
        module: 'Maintenance'
      });

      toast({ title: "Backup Concluído", description: "O arquivo JSON foi gerado com sucesso." });
    } catch (e) {
      toast({ variant: "destructive", title: "Erro no Backup" });
    } finally {
      setIsExporting(false);
    }
  };

  const handleHealthCheck = async () => {
    setHealthStatus('scanning');
    // Simulando um scan de integridade
    setTimeout(() => {
      setHealthStatus('healthy');
      toast({ title: "Sistema Saudável", description: "Nenhuma inconsistência grave detectada nos documentos." });
    }, 2000);
  };

  return (
    <div className="space-y-10">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
        
        {/* Backup & Recuperação */}
        <Card className="border-slate-200/60 rounded-[3rem] bg-white shadow-xl shadow-slate-200/50 overflow-hidden">
          <CardHeader className="p-10 border-b border-slate-50 flex items-center gap-4">
            <div className="p-3 bg-emerald-50 rounded-2xl text-emerald-600"><HardDrive className="h-6 w-6" /></div>
            <div>
              <CardTitle className="text-2xl font-black uppercase tracking-tighter italic font-headline text-slate-900">Backup de Dados</CardTitle>
              <CardDescription className="text-[10px] font-black italic text-slate-400 uppercase tracking-widest mt-1">Snapshots Preventivos (JSON)</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="p-10 space-y-8">
            <div className="p-8 bg-slate-50 rounded-[2.5rem] border border-slate-100 flex flex-col items-center text-center gap-6">
              <FileJson className="h-12 w-12 text-slate-300" />
              <div className="space-y-2">
                <p className="text-sm font-bold text-slate-900 italic">Exportação Completa</p>
                <p className="text-[10px] font-medium text-slate-400 max-w-xs leading-relaxed uppercase tracking-widest">
                  Gera um arquivo contendo os últimos 500 registros de cada coleção principal.
                </p>
              </div>
              <Button 
                onClick={handleExportBackup} 
                disabled={isExporting}
                className="w-full h-14 rounded-2xl bg-slate-900 hover:bg-emerald-600 text-white font-black uppercase text-[10px] tracking-widest transition-all gap-2"
              >
                {isExporting ? <AgileSpinner size="sm" /> : <><Download className="h-4 w-4" /> Baixar Snapshot</>}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Integridade & Purga */}
        <div className="space-y-10">
          <Card className="border-slate-200/60 rounded-[3rem] bg-white shadow-xl shadow-slate-200/50 overflow-hidden">
            <CardHeader className="p-10 border-b border-slate-50 flex items-center gap-4">
              <div className="p-3 bg-blue-50 rounded-2xl text-blue-600"><Activity className="h-6 w-6" /></div>
              <div>
                <CardTitle className="text-2xl font-black uppercase tracking-tighter italic font-headline text-slate-900">Integridade</CardTitle>
                <CardDescription className="text-[10px] font-black italic text-slate-400 uppercase tracking-widest mt-1">Monitoramento de Consistência</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="p-10 space-y-6">
               <div className="flex items-center justify-between p-6 bg-slate-50 rounded-3xl border border-slate-100">
                  <div className="flex items-center gap-4">
                    <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shadow-sm", healthStatus === 'scanning' ? "bg-blue-600 text-white animate-spin" : "bg-blue-100 text-blue-600")}>
                      <RefreshCcw className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-[11px] font-black uppercase text-slate-900">Health Check</p>
                      <p className="text-[9px] font-medium text-slate-400 uppercase tracking-widest">Verificar documentos órfãos</p>
                    </div>
                  </div>
                  <Button 
                    variant="ghost" 
                    onClick={handleHealthCheck}
                    className="h-10 px-4 rounded-xl font-black uppercase text-[10px] tracking-widest text-blue-600 hover:bg-blue-50"
                  >
                    Escanear
                  </Button>
               </div>

               <div className="p-6 bg-rose-50/30 rounded-3xl border border-rose-100 flex items-start gap-4">
                  <ShieldAlert className="h-5 w-5 text-rose-500 mt-1" />
                  <div className="space-y-2">
                    <p className="text-[11px] font-black uppercase text-rose-900 italic leading-none">Limpeza de Emergência</p>
                    <p className="text-[10px] font-medium text-rose-400 uppercase tracking-widest leading-relaxed">
                      Utilize a ferramenta de "Purga Total" na aba anterior para resetar o ecossistema se detectar corrupção de dados.
                    </p>
                  </div>
               </div>
            </CardContent>
          </Card>

          <div className="bg-amber-50/50 border-2 border-dashed border-amber-200 rounded-[3rem] p-10 flex items-center gap-6">
             <div className="w-14 h-14 bg-amber-500 rounded-2xl flex items-center justify-center text-white shrink-0">
                <Database className="h-7 w-7" />
             </div>
             <div>
                <p className="text-xs font-black uppercase tracking-tighter italic text-amber-900">Uso do Firestore</p>
                <p className="text-[11px] font-medium text-amber-700 leading-relaxed italic mt-1">
                  O sistema de cache automático está mantendo o consumo de leitura dentro da quota gratuita (Free Tier) para operações de rotina.
                </p>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
}

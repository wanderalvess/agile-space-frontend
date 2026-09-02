'use client';

import React, { useState, useEffect, useMemo, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Users,
  ArrowLeft,
  Search,
  Save,
  Download,
  Upload,
  RefreshCw,
  Sliders,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  FileSpreadsheet,
  Building2,
  Sparkles,
  RotateCcw,
  ExternalLink,
  ChevronRight,
  Shield,
  Clock,
  Calculator,
  UserPlus
} from 'lucide-react';
import NiceAvatar, { genConfig } from 'react-nice-avatar';

import { useUserContext } from '@/context/UserContext';
import { getJiraCredentials } from '@/hooks/useJiraSettings';
import { useSquadStore } from '@/store/useSquadStore';
import { useToast } from '@/hooks/use-toast';
import type { SquadMember } from '@/lib/types';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const SQUAD_ROLES = [
  'Developer',
  'QA',
  'Tech Lead',
  'Product Owner',
  'Agile Master',
  'Scrum Master',
  'People Lead',
  'UX/Designer',
  'SME',
  'Tribe Lead',
];

function RosterContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const squadIdFromUrl = searchParams.get('squadId');
  const cameFromOnboarding = searchParams.get('onboarding') === '1';
  const { userProfile } = useUserContext();
  const { toast } = useToast();

  const activeSquadId = squadIdFromUrl || userProfile?.squadId || '';

  const {
    config,
    members,
    fetchSquad,
    fetchMembers,
    saveMemberCapacity,
    batchUpdateMembers,
    saveSquadConfig,
    syncSquad,
    isSyncing,
    isLoading
  } = useSquadStore();

  const handleSyncFromJira = async () => {
    const userIdentifier = userProfile?.id || userProfile?.email;
    if (!userIdentifier || !activeSquadId) return;
    const creds = await getJiraCredentials(userIdentifier);
    if (!creds?.token) {
      toast({
        title: 'Token Jira não encontrado',
        description: 'Informe seu Token de Acesso (PAT) nas configurações do Squad Hub antes de sincronizar.',
        variant: 'destructive',
      });
      router.push('/squad');
      return;
    }
    try {
      await syncSquad(userIdentifier, activeSquadId);
      await fetchMembers(activeSquadId, userIdentifier, {
        email: userProfile?.email,
        jiraAccountId: userProfile?.jiraAccountId,
        name: userProfile?.name,
      });
      toast({ title: 'Sincronizado', description: 'Integrantes carregados a partir do Jira.' });
    } catch (err: any) {
      toast({ title: 'Erro ao sincronizar', description: err?.message || 'Tente novamente.', variant: 'destructive' });
    }
  };

  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [overrideFilter, setOverrideFilter] = useState('ALL');

  // Rule settings state
  const [calcMethod, setCalcMethod] = useState<string>('STANDARD');
  const [customJql, setCustomJql] = useState<string>('');
  const [customFormula, setCustomFormula] = useState<string>('0.85'); // default 85% focus factor
  const [baseCapacity, setBaseCapacity] = useState<number>(8);
  const [isSavingRule, setIsSavingRule] = useState(false);

  // Edit draft state per member: { [jiraAccountId]: { capacity: number, role: string, notes: string } }
  const [editDrafts, setEditDrafts] = useState<Record<string, { capacity: number; role: string; notes: string }>>({});
  const [savingMemberId, setSavingMemberId] = useState<string | null>(null);

  // Import Modal State
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [importedRows, setImportedRows] = useState<Array<{
    jiraAccountId: string;
    displayName: string;
    role: string;
    email: string;
    importedCapacity: number;
    notes: string;
    existingMember?: SquadMember;
  }>>([]);
  const [isApplyingImport, setIsApplyingImport] = useState(false);

  // Load squad & members on mount
  useEffect(() => {
    if (activeSquadId) {
      fetchSquad(activeSquadId);
      fetchMembers(activeSquadId);
    }
  }, [activeSquadId, fetchSquad, fetchMembers]);

  // Sync squad config to local rule state
  useEffect(() => {
    if (config) {
      setCalcMethod(config.capacityCalculationMethod || 'STANDARD');
      setCustomJql(config.capacityJql || '');
      setCustomFormula(config.capacityFormula || '0.85');
      setBaseCapacity(config.defaultDailyCapacityHours || 8);
    }
  }, [config]);

  // Initialize editDrafts when members load
  useEffect(() => {
    const drafts: Record<string, { capacity: number; role: string; notes: string }> = {};
    members.forEach(m => {
      drafts[m.jiraAccountId] = {
        capacity: m.capacityHoursPerDay ?? 8,
        role: m.role || 'Developer',
        notes: m.calibrationNotes || '',
      };
    });
    setEditDrafts(drafts);
  }, [members]);

  // Helper to compute system calculated capacity based on current rule
  const calculateSystemHours = (m: SquadMember) => {
    if (m.systemCalculatedCapacityHoursPerDay && m.systemCalculatedCapacityHoursPerDay > 0) {
      return m.systemCalculatedCapacityHoursPerDay;
    }
    const base = baseCapacity || 8;
    if (calcMethod === 'CUSTOM_FORMULA') {
      const factor = parseFloat(customFormula) || 0.85;
      return Math.round(base * factor * 10) / 10;
    }
    return base;
  };

  // Filtered member list
  const filteredMembers = useMemo(() => {
    return members.filter(m => {
      const matchesSearch =
        m.displayName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (m.email && m.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
        m.jiraAccountId.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesRole = roleFilter === 'ALL' || (m.role || 'Developer') === roleFilter;

      const overrideType = m.overrideType || (m.capacityHoursPerDay && m.capacityHoursPerDay !== 8 ? 'MANUAL_OVERRIDE' : 'SYSTEM');
      const matchesOverride =
        overrideFilter === 'ALL' ||
        (overrideFilter === 'OVERRIDDEN' && overrideType !== 'SYSTEM') ||
        (overrideFilter === 'SYSTEM' && overrideType === 'SYSTEM');

      return matchesSearch && matchesRole && matchesOverride;
    });
  }, [members, searchTerm, roleFilter, overrideFilter]);

  // KPI Calculations
  const totalMembersCount = members.length;
  const totalCalibratedDailyHours = members.reduce((sum, m) => sum + (m.capacityHoursPerDay ?? 8), 0);
  const totalSystemDailyHours = members.reduce((sum, m) => sum + calculateSystemHours(m), 0);
  const avgCalibratedDailyHours = totalMembersCount > 0 ? (totalCalibratedDailyHours / totalMembersCount).toFixed(1) : '8.0';
  const customOverridesCount = members.filter(m => m.overrideType && m.overrideType !== 'SYSTEM').length;

  // Save Squad Calculation Rule
  const handleSaveRule = async () => {
    setIsSavingRule(true);
    try {
      await saveSquadConfig(activeSquadId, {
        jiraProjectKey: config?.jiraProjectKey || activeSquadId,
        syncJql: config?.syncJql || '',
        rankingEnabled: config?.rankingEnabled ?? false,
        defaultDailyCapacityHours: baseCapacity,
        capacityCalculationMethod: calcMethod,
        capacityJql: customJql,
        capacityFormula: customFormula,
      });

      toast({
        title: 'Regra de Cálculo Salva',
        description: 'A regra de cálculo de capacidade do sistema foi atualizada com sucesso.',
      });
    } catch (err: any) {
      toast({
        title: 'Erro ao Salvar Regra',
        description: err?.message || 'Tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setIsSavingRule(false);
    }
  };

  // Recalculate system column for all members
  const handleRecalculateSystemColumn = async () => {
    const updatedMembers = members.map(m => {
      const systemVal = calculateSystemHours(m);
      return {
        ...m,
        systemCalculatedCapacityHoursPerDay: systemVal,
      };
    });

    try {
      await batchUpdateMembers(activeSquadId, updatedMembers);
      toast({
        title: 'Coluna Sugerida Recalculada',
        description: 'Os valores sugeridos pelo sistema foram atualizados para todos os integrantes.',
      });
    } catch (err: any) {
      toast({
        title: 'Erro ao Recalcular',
        description: err?.message || 'Falha ao atualizar dados.',
        variant: 'destructive',
      });
    }
  };

  // Save single member calibration row
  const handleSaveMemberRow = async (m: SquadMember) => {
    const draft = editDrafts[m.jiraAccountId];
    if (!draft) return;

    setSavingMemberId(m.jiraAccountId);
    try {
      const systemVal = calculateSystemHours(m);
      const isOverride = draft.capacity !== systemVal;
      const overrideType = isOverride ? 'MANUAL_OVERRIDE' : 'SYSTEM';

      await saveMemberCapacity(activeSquadId, m.jiraAccountId, {
        displayName: m.displayName,
        role: draft.role,
        capacityHoursPerDay: draft.capacity,
        systemCalculatedCapacityHoursPerDay: systemVal,
        calibrationNotes: draft.notes,
        overrideType,
      });

      toast({
        title: 'Hora Real Salva',
        description: `Carga horária de ${m.displayName} definida para ${draft.capacity}h/dia.`,
      });
    } catch (err: any) {
      toast({
        title: 'Erro ao Salvar',
        description: err?.message || 'Tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setSavingMemberId(null);
    }
  };

  // Reset member to system calculation
  const handleResetToSystem = async (m: SquadMember) => {
    const systemVal = calculateSystemHours(m);
    setEditDrafts(prev => ({
      ...prev,
      [m.jiraAccountId]: {
        ...prev[m.jiraAccountId],
        capacity: systemVal,
        notes: '',
      },
    }));

    setSavingMemberId(m.jiraAccountId);
    try {
      await saveMemberCapacity(activeSquadId, m.jiraAccountId, {
        displayName: m.displayName,
        role: m.role || 'Developer',
        capacityHoursPerDay: systemVal,
        systemCalculatedCapacityHoursPerDay: systemVal,
        calibrationNotes: '',
        overrideType: 'SYSTEM',
      });

      toast({
        title: 'Restaurado para Sugestão Padrão',
        description: `${m.displayName} foi redefinido para a hora sugerida do sistema (${systemVal}h/dia).`,
      });
    } catch (err: any) {
      toast({
        title: 'Erro ao Restaurar',
        description: err?.message || 'Falha ao atualizar.',
        variant: 'destructive',
      });
    } finally {
      setSavingMemberId(null);
    }
  };

  // EXPORT CSV Functionality
  const handleExportCSV = () => {
    if (members.length === 0) {
      toast({ title: 'Sem dados', description: 'Nenhum membro na equipe para exportar.', variant: 'destructive' });
      return;
    }

    const headers = [
      'JiraAccountId',
      'Nome',
      'Email',
      'Funcao',
      'Horas_Sugeridas_Sistema_Dia',
      'Horas_Reais_Gestor_Dia',
      'Fonte_Carga_Horaria',
      'Observacoes'
    ];

    const rows = members.map(m => {
      const draft = editDrafts[m.jiraAccountId] || { capacity: m.capacityHoursPerDay ?? 8, role: m.role || 'Developer', notes: m.calibrationNotes || '' };
      const sysHours = calculateSystemHours(m);
      const override = m.overrideType || (draft.capacity !== sysHours ? 'MANUAL_OVERRIDE' : 'SYSTEM');

      return [
        `"${m.jiraAccountId}"`,
        `"${m.displayName.replace(/"/g, '""')}"`,
        `"${(m.email || '').replace(/"/g, '""')}"`,
        `"${(draft.role || 'Developer').replace(/"/g, '""')}"`,
        sysHours,
        draft.capacity,
        `"${override}"`,
        `"${(draft.notes || '').replace(/"/g, '""')}"`
      ].join(',');
    });

    const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `capacidade_equipe_${activeSquadId}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({
      title: 'Exportação Concluída',
      description: `Planilha com ${members.length} integrantes exportada com sucesso em CSV.`,
    });
  };

  // IMPORT FILE Functionality
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const text = evt.target?.result as string;
        const lines = text.split(/\r?\n/).filter(line => line.trim().length > 0);
        if (lines.length < 2) {
          toast({ title: 'Arquivo inválido', description: 'O arquivo não possui dados suficientes.', variant: 'destructive' });
          return;
        }

        const parsedRows: Array<{
          jiraAccountId: string;
          displayName: string;
          role: string;
          email: string;
          importedCapacity: number;
          notes: string;
          existingMember?: SquadMember;
        }> = [];

        for (let i = 1; i < lines.length; i++) {
          const rowStr = lines[i];
          const cols = rowStr.split(',').map(c => c.replace(/^"|"$/g, '').trim());
          if (cols.length < 2) continue;

          const jiraAccountId = cols[0];
          const displayName = cols[1] || jiraAccountId;
          const email = cols[2] || '';
          const role = cols[3] || 'Developer';
          const capacityVal = parseFloat(cols[5] || cols[4]) || 8;
          const notes = cols[7] || cols[6] || '';

          const existing = members.find(m =>
            m.jiraAccountId.toLowerCase() === jiraAccountId.toLowerCase() ||
            (m.email && email && m.email.toLowerCase() === email.toLowerCase()) ||
            m.displayName.toLowerCase() === displayName.toLowerCase()
          );

          parsedRows.push({
            jiraAccountId: existing ? existing.jiraAccountId : jiraAccountId,
            displayName: existing ? existing.displayName : displayName,
            role: role || (existing?.role || 'Developer'),
            email: email || (existing?.email || ''),
            importedCapacity: capacityVal,
            notes: notes || 'Importado via planilha',
            existingMember: existing,
          });
        }

        setImportedRows(parsedRows);
        setIsImportOpen(true);
      } catch (err: any) {
        toast({ title: 'Erro na Leitura', description: 'Não foi possível ler o arquivo CSV/Excel.', variant: 'destructive' });
      }
    };
    reader.readAsText(file);
  };

  // Confirm Import
  const handleConfirmImport = async () => {
    if (importedRows.length === 0) return;
    setIsApplyingImport(true);

    try {
      const updatedMembersBatch: SquadMember[] = importedRows.map(row => {
        const existing = row.existingMember;
        const dbId = existing?.dbId || `${activeSquadId}_${row.jiraAccountId}`;

        return {
          dbId,
          squadId: activeSquadId,
          jiraAccountId: row.jiraAccountId,
          displayName: row.displayName,
          email: row.email,
          role: row.role,
          capacityHoursPerDay: row.importedCapacity,
          systemCalculatedCapacityHoursPerDay: existing ? calculateSystemHours(existing) : 8,
          calibrationNotes: row.notes,
          overrideType: 'IMPORTED_EXCEL',
          claimedByUid: existing?.claimedByUid,
          updatedAt: new Date().toISOString(),
        };
      });

      await batchUpdateMembers(activeSquadId, updatedMembersBatch);

      toast({
        title: 'Importação Concluída',
        description: `${updatedMembersBatch.length} integrantes atualizados com sucesso!`,
      });

      setIsImportOpen(false);
      setImportedRows([]);
    } catch (err: any) {
      toast({
        title: 'Erro na Importação',
        description: err?.message || 'Falha ao salvar dados importados.',
        variant: 'destructive',
      });
    } finally {
      setIsApplyingImport(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50/60 dark:bg-slate-950 p-4 lg:p-8 space-y-8">
      {/* Top Header & Breadcrumbs */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5">
            <button onClick={() => router.push('/squad')} className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors flex items-center gap-1">
              <ArrowLeft className="h-3.5 w-3.5" /> Squad Hub
            </button>
            <ChevronRight className="h-3 w-3" />
            <span className="text-slate-700 dark:text-slate-300">Gestão do Time & Capacidade</span>
          </div>
          <h1 className="text-2xl lg:text-3xl font-black uppercase tracking-tight text-slate-900 dark:text-white flex items-center gap-3">
            <Users className="h-8 w-8 text-indigo-600 dark:text-indigo-400" />
            Gestão do Time & Capacidade de Horas
            <Badge variant="outline" className="text-xs font-bold bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800">
              Squad: {activeSquadId}
            </Badge>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-2xl">
            Defina o tempo real de cada integrante da equipe. As horas configuradas nesta tela refletem automaticamente no **Sprint Planner**, nos gráficos de liderança e em todo o sistema.
          </p>
        </div>

        {/* Action Buttons Header */}
        <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push(`/admin`)}
            className="h-9 text-xs font-bold gap-1.5 rounded-xl border-slate-300 dark:border-slate-700"
          >
            <Shield className="h-4 w-4 text-slate-500" /> Painel Admin
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push(`/sprint-planner`)}
            className="h-9 text-xs font-bold gap-1.5 rounded-xl border-slate-300 dark:border-slate-700"
          >
            <Calculator className="h-4 w-4 text-violet-500" /> Abrir Sprint Planner
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCSV}
            className="h-9 text-xs font-bold gap-1.5 rounded-xl border-indigo-200 dark:border-indigo-900 text-indigo-700 dark:text-indigo-300 bg-indigo-50/50 dark:bg-indigo-950/20 hover:bg-indigo-100"
          >
            <Download className="h-4 w-4 text-indigo-600 dark:text-indigo-400" /> Exportar Planilha
          </Button>

          <label className="cursor-pointer">
            <input type="file" accept=".csv, .txt, .xlsx" onChange={handleFileUpload} className="hidden" />
            <div className="h-9 px-3.5 text-xs font-bold gap-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-500/20 flex items-center justify-center transition-all">
              <Upload className="h-4 w-4" /> Importar Planilha
            </div>
          </label>
        </div>
      </div>

      {cameFromOnboarding && (
        <div className="rounded-2xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50/70 dark:bg-indigo-950/30 px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <Sparkles className="h-5 w-5 text-indigo-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-bold text-indigo-900 dark:text-indigo-100">Último passo do onboarding: horas do time</p>
              <p className="text-xs text-indigo-700/80 dark:text-indigo-300/80 mt-0.5">
                Defina quantas horas por dia cada pessoa dedica ao squad. Isso alimenta Sprint Planner e capacidade. Pode pular e voltar aqui depois pelo Squad Hub.
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => router.push('/')} className="h-9 text-xs font-bold rounded-xl shrink-0">
            Pular por agora <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}

      {/* KPI Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl shadow-sm">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Total de Integrantes</p>
              <h3 className="text-2xl font-black text-slate-900 dark:text-white mt-1">{totalMembersCount} pessoas</h3>
              <p className="text-[10px] text-slate-400 mt-1">Membros ativos na equipe</p>
            </div>
            <div className="p-3 rounded-2xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400">
              <Users className="h-6 w-6" />
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl shadow-sm">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Capacidade Total Real</p>
              <h3 className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">{totalCalibratedDailyHours}h / dia</h3>
              <p className="text-[10px] text-slate-400 mt-1">~{(totalCalibratedDailyHours * 5).toFixed(0)}h / semana total da equipe</p>
            </div>
            <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400">
              <Clock className="h-6 w-6" />
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl shadow-sm">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Horas Sugeridas (Sistema)</p>
              <h3 className="text-2xl font-black text-slate-700 dark:text-slate-300 mt-1">{totalSystemDailyHours}h / dia</h3>
              <p className="text-[10px] text-slate-400 mt-1">Regra de cálculo ativa ({calcMethod})</p>
            </div>
            <div className="p-3 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
              <Calculator className="h-6 w-6" />
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl shadow-sm">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Horas Personalizadas</p>
              <h3 className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-1">{customOverridesCount} pessoas</h3>
              <p className="text-[10px] text-slate-400 mt-1">Ajustadas manualmente pelo gestor</p>
            </div>
            <div className="p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400">
              <Sliders className="h-6 w-6" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* System Calculation Rule Config Card */}
      <Card className="rounded-2xl border border-indigo-100 dark:border-indigo-900/50 bg-gradient-to-br from-indigo-50/40 via-white to-white dark:from-indigo-950/20 dark:via-slate-900 dark:to-slate-900 shadow-sm overflow-hidden">
        <CardHeader className="pb-3 border-b border-indigo-100/60 dark:border-indigo-900/40">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-indigo-600 text-white">
                <Sparkles className="h-4 w-4" />
              </div>
              <div>
                <CardTitle className="text-base font-black uppercase tracking-tight text-slate-900 dark:text-white">
                  Regra de Cálculo Automático do Sistema
                </CardTitle>
                <CardDescription className="text-xs text-slate-500 dark:text-slate-400">
                  Defina como o sistema pré-calcula as horas sugeridas para cada integrante (o gestor sempre pode informar o valor real final).
                </CardDescription>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleRecalculateSystemColumn}
                className="h-8 text-xs font-bold gap-1.5 rounded-xl border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300"
              >
                <RefreshCw className="h-3.5 w-3.5" /> Recalcular Horas Sugeridas
              </Button>

              <Button
                size="sm"
                onClick={handleSaveRule}
                disabled={isSavingRule}
                className="h-8 text-xs font-bold gap-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white"
              >
                <Save className="h-3.5 w-3.5" /> {isSavingRule ? 'Salvando...' : 'Salvar Regra'}
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs font-extrabold uppercase text-slate-600 dark:text-slate-300">Método de Cálculo</Label>
            <Select value={calcMethod} onValueChange={setCalcMethod}>
              <SelectTrigger className="h-9 rounded-xl text-xs bg-white dark:bg-slate-950">
                <SelectValue placeholder="Selecione o método" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="STANDARD">Padrão Fixo da Equipe (ex: 8h/dia)</SelectItem>
                <SelectItem value="JIRA_WORKLOG_AVERAGE">Média de Worklogs do Jira (JQL)</SelectItem>
                <SelectItem value="CUSTOM_FORMULA">Fator de Foco (Desconto de Reuniões/Cerimônias)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {calcMethod === 'STANDARD' && (
            <div className="space-y-1.5">
              <Label className="text-xs font-extrabold uppercase text-slate-600 dark:text-slate-300">Carga Horária Padrão (h/dia)</Label>
              <Input
                type="number" min={1} max={16}
                value={baseCapacity}
                onChange={e => setBaseCapacity(Number(e.target.value) || 8)}
                className="h-9 rounded-xl text-xs bg-white dark:bg-slate-950"
              />
            </div>
          )}

          {calcMethod === 'JIRA_WORKLOG_AVERAGE' && (
            <div className="space-y-1.5 md:col-span-2">
              <Label className="text-xs font-extrabold uppercase text-slate-600 dark:text-slate-300">Consulta JQL para Média de Horas</Label>
              <Input
                placeholder="project = MISSI AND worklogDate >= -30d"
                value={customJql}
                onChange={e => setCustomJql(e.target.value)}
                className="h-9 rounded-xl text-xs font-mono bg-white dark:bg-slate-950"
              />
            </div>
          )}

          {calcMethod === 'CUSTOM_FORMULA' && (
            <div className="space-y-1.5 md:col-span-2">
              <Label className="text-xs font-extrabold uppercase text-slate-600 dark:text-slate-300">Fator de Foco (Ex: 0.85 = 85% produção / 15% reuniões)</Label>
              <Input
                placeholder="0.85"
                value={customFormula}
                onChange={e => setCustomFormula(e.target.value)}
                className="h-9 rounded-xl text-xs font-mono bg-white dark:bg-slate-950"
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Main Table Card */}
      <Card className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
        {/* Table Toolbar */}
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex flex-col md:flex-row items-center justify-between gap-3">
          <div className="relative w-full md:w-80">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Buscar integrante por nome, email ou ID..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="pl-9 h-9 rounded-xl text-xs bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800"
            />
          </div>

          <div className="flex items-center gap-2.5 w-full md:w-auto flex-wrap">
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="h-9 rounded-xl text-xs w-36 bg-slate-50 dark:bg-slate-950">
                <SelectValue placeholder="Cargo / Função" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todos os Cargos</SelectItem>
                {SQUAD_ROLES.map(r => (
                  <SelectItem key={r} value={r}>{r}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={overrideFilter} onValueChange={setOverrideFilter}>
              <SelectTrigger className="h-9 rounded-xl text-xs w-44 bg-slate-50 dark:bg-slate-950">
                <SelectValue placeholder="Fonte da Carga" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todas as Fontes</SelectItem>
                <SelectItem value="OVERRIDDEN">Definidas pelo Gestor</SelectItem>
                <SelectItem value="SYSTEM">Sugestão do Sistema</SelectItem>
              </SelectContent>
            </Select>

            <Badge variant="secondary" className="h-9 px-3 rounded-xl text-xs font-bold shrink-0">
              {filteredMembers.length} de {members.length} integrantes
            </Badge>
          </div>
        </div>

        {/* Members Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-950/60 border-b border-slate-100 dark:border-slate-800 text-[10px] uppercase font-black tracking-wider text-slate-400">
              <tr>
                <th className="py-3.5 px-4">Integrante / Pessoa</th>
                <th className="py-3.5 px-4">Cargo / Função</th>
                <th className="py-3.5 px-4 text-center">Horas Sugeridas (Sistema)</th>
                <th className="py-3.5 px-4 text-center">Horas Reais Definidas (Gestor)</th>
                <th className="py-3.5 px-4 text-center">Semanal (h)</th>
                <th className="py-3.5 px-4 text-center">Sprint (10 dias)</th>
                <th className="py-3.5 px-4 text-center">Variação</th>
                <th className="py-3.5 px-4">Fonte da Carga Horária</th>
                <th className="py-3.5 px-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {members.length === 0 && !isLoading ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center">
                    <Users className="h-8 w-8 mx-auto text-slate-300 dark:text-slate-700 mb-2" />
                    <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">Nenhum integrante carregado ainda.</p>
                    <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                      Os integrantes vêm do quadro do Jira (assignees da sprint ativa). Sincronize uma vez pra montar a lista e depois ajuste as horas de cada pessoa aqui.
                    </p>
                    <Button
                      size="sm"
                      onClick={handleSyncFromJira}
                      disabled={isSyncing}
                      className="mt-4 h-9 text-xs font-bold gap-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white"
                    >
                      <RefreshCw className={`h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} /> Sincronizar com o Jira
                    </Button>
                  </td>
                </tr>
              ) : filteredMembers.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    <Users className="h-8 w-8 mx-auto text-slate-300 dark:text-slate-700 mb-2" />
                    Nenhum integrante encontrado. Altere os filtros de busca.
                  </td>
                </tr>
              ) : (
                filteredMembers.map(m => {
                  const draft = editDrafts[m.jiraAccountId] || { capacity: m.capacityHoursPerDay ?? 8, role: m.role || 'Developer', notes: m.calibrationNotes || '' };
                  const systemHours = calculateSystemHours(m);
                  const calibratedHours = draft.capacity;
                  const weeklyHours = (calibratedHours * 5).toFixed(0);
                  const sprintHours = (calibratedHours * 10).toFixed(0);

                  const diffPercent = systemHours > 0 ? (((calibratedHours - systemHours) / systemHours) * 100).toFixed(0) : '0';
                  const diffNumber = Number(diffPercent);

                  const isOverridden = m.overrideType && m.overrideType !== 'SYSTEM' || draft.capacity !== systemHours;
                  const isSavingThis = savingMemberId === m.jiraAccountId;

                  return (
                    <tr key={m.jiraAccountId} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                      {/* Name & Avatar */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <NiceAvatar className="h-8 w-8 rounded-full border border-slate-200 dark:border-slate-700 shrink-0" {...genConfig(m.displayName || m.jiraAccountId)} />
                          <div className="truncate max-w-[180px]">
                            <p className="font-bold text-slate-800 dark:text-slate-100 truncate">{m.displayName}</p>
                            <p className="text-[10px] text-slate-400 truncate">{m.email || m.jiraAccountId}</p>
                          </div>
                        </div>
                      </td>

                      {/* Role Selector */}
                      <td className="py-3 px-4">
                        <Select
                          value={draft.role}
                          onValueChange={val => setEditDrafts(prev => ({ ...prev, [m.jiraAccountId]: { ...prev[m.jiraAccountId], role: val } }))}
                        >
                          <SelectTrigger className="h-7 text-[11px] w-32 border-transparent hover:border-slate-200 dark:hover:border-slate-800 bg-transparent font-medium">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {SQUAD_ROLES.map(r => (
                              <SelectItem key={r} value={r}>{r}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>

                      {/* System Hours (Read-Only) */}
                      <td className="py-3 px-4 text-center">
                        <Badge variant="outline" className="text-xs font-mono font-bold bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300">
                          {systemHours}h / dia
                        </Badge>
                      </td>

                      {/* Calibrated Hours (Input Editable) */}
                      <td className="py-3 px-4 text-center">
                        <div className="inline-flex items-center gap-1">
                          <Input
                            type="number"
                            step="0.5"
                            min="1"
                            max="16"
                            value={draft.capacity}
                            onChange={e => {
                              const val = parseFloat(e.target.value) || 1;
                              setEditDrafts(prev => ({
                                ...prev,
                                [m.jiraAccountId]: { ...prev[m.jiraAccountId], capacity: val }
                              }));
                            }}
                            className="h-7 w-16 text-center text-xs font-bold bg-white dark:bg-slate-950 border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 focus:ring-indigo-500"
                          />
                          <span className="text-[10px] text-slate-400 font-bold">h/dia</span>
                        </div>
                      </td>

                      {/* Weekly Total */}
                      <td className="py-3 px-4 text-center font-mono font-bold text-slate-700 dark:text-slate-300">
                        {weeklyHours}h
                      </td>

                      {/* Sprint Total */}
                      <td className="py-3 px-4 text-center font-mono font-bold text-indigo-600 dark:text-indigo-400">
                        {sprintHours}h
                      </td>

                      {/* Variation (%) */}
                      <td className="py-3 px-4 text-center">
                        {diffNumber === 0 ? (
                          <span className="text-[10px] text-slate-400 font-semibold">0%</span>
                        ) : diffNumber > 0 ? (
                          <Badge className="text-[9px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                            +{diffNumber}%
                          </Badge>
                        ) : (
                          <Badge className="text-[9px] font-bold bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                            {diffNumber}%
                          </Badge>
                        )}
                      </td>

                      {/* Origin / Status Badge */}
                      <td className="py-3 px-4">
                        {m.overrideType === 'IMPORTED_EXCEL' ? (
                          <Badge className="text-[9px] font-bold bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-200 dark:border-purple-800 gap-1">
                            <FileSpreadsheet className="h-3 w-3" /> Planilha Excel
                          </Badge>
                        ) : isOverridden ? (
                          <Badge className="text-[9px] font-bold bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 gap-1">
                            <Sliders className="h-3 w-3" /> Gestor
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[9px] font-bold text-slate-500 border-slate-200 dark:border-slate-800 gap-1">
                            <Calculator className="h-3 w-3" /> Sugestão Sistema
                          </Badge>
                        )}
                      </td>

                      {/* Action Buttons */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {isOverridden && (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleResetToSystem(m)}
                                    className="h-7 w-7 text-slate-400 hover:text-amber-600 rounded-lg"
                                  >
                                    <RotateCcw className="h-3.5 w-3.5" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent className="text-[10px]">Restaurar para sugestão do sistema</TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}

                          <Button
                            size="sm"
                            onClick={() => handleSaveMemberRow(m)}
                            disabled={isSavingThis}
                            className="h-7 px-2.5 text-[10px] font-bold gap-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white"
                          >
                            <Save className="h-3 w-3" /> {isSavingThis ? '...' : 'Salvar'}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Excel / CSV Import Confirmation Modal */}
      <Dialog open={isImportOpen} onOpenChange={setIsImportOpen}>
        <DialogContent className="max-w-3xl rounded-3xl p-6 max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg font-black uppercase tracking-tight flex items-center gap-2 text-indigo-600 dark:text-indigo-400">
              <Upload className="h-5 w-5" /> Prévia da Importação de Carga Horária
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Confira os integrantes e as novas horas definidas antes de aplicar as alterações na equipe.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 my-3">
            <div className="overflow-x-auto max-h-60 rounded-xl border border-slate-200 dark:border-slate-800">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 dark:bg-slate-800 text-[10px] uppercase font-bold text-slate-500">
                  <tr>
                    <th className="py-2.5 px-3">Nome / Account ID</th>
                    <th className="py-2.5 px-3">Cargo</th>
                    <th className="py-2.5 px-3 text-center">Horas Atuais (h/dia)</th>
                    <th className="py-2.5 px-3 text-center">Novas Horas Reais (h/dia)</th>
                    <th className="py-2.5 px-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {importedRows.map((row, idx) => {
                    const currentCap = row.existingMember?.capacityHoursPerDay ?? 8;
                    const isChanged = currentCap !== row.importedCapacity;
                    return (
                      <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-900/50">
                        <td className="py-2 px-3">
                          <p className="font-bold text-slate-800 dark:text-slate-200">{row.displayName}</p>
                          <p className="text-[10px] text-slate-400">{row.jiraAccountId}</p>
                        </td>
                        <td className="py-2 px-3">{row.role}</td>
                        <td className="py-2 px-3 text-center font-mono text-slate-500">{currentCap}h</td>
                        <td className="py-2 px-3 text-center font-mono font-bold text-indigo-600 dark:text-indigo-400">
                          {row.importedCapacity}h
                        </td>
                        <td className="py-2 px-3">
                          {row.existingMember ? (
                            isChanged ? (
                              <Badge className="text-[9px] bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300">Alterado</Badge>
                            ) : (
                              <Badge variant="outline" className="text-[9px]">Sem mudança</Badge>
                            )
                          ) : (
                            <Badge className="text-[9px] bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">Novo Integrante</Badge>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => setIsImportOpen(false)} className="rounded-xl text-xs font-bold">
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={handleConfirmImport}
              disabled={isApplyingImport}
              className="rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5"
            >
              <CheckCircle2 className="h-4 w-4" /> {isApplyingImport ? 'Aplicando...' : `Confirmar e Importar (${importedRows.length})`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function RosterPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-xs font-bold text-slate-400">Carregando Gestão do Time & Capacidade...</div>}>
      <RosterContent />
    </Suspense>
  );
}

'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { workItemsApi } from '@/app/work-items-api';
import { Target, TrendingUp, AlertCircle, CheckCircle2, RefreshCw } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8002/api';

export function CeremoniesDashboard() {
  const [squads, setSquads] = useState<any[]>([]);
  const [selectedSquadId, setSelectedSquadId] = useState<string>('');
  const [sprintId, setSprintId] = useState<string>('');
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch(`${API_BASE}/squads`)
      .then(res => res.ok ? res.json() : [])
      .then(data => {
        setSquads(data);
        if (data.length > 0) {
          setSelectedSquadId(data[0].id);
          if (data[0].activeSprintId) {
            setSprintId(data[0].activeSprintId);
          }
        }
      })
      .catch(() => {});
  }, []);

  const fetchStats = async () => {
    if (!selectedSquadId || !sprintId) return;
    setLoading(true);
    try {
      const data = await workItemsApi.getSprintStats(selectedSquadId, sprintId);
      setStats(data);
    } catch (e) {
      console.error(e);
      setStats(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedSquadId && sprintId) {
      fetchStats();
    }
  }, [selectedSquadId, sprintId]);

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-black uppercase tracking-tighter italic font-headline text-slate-900 dark:text-slate-100">
          Analytics de Cerimônias & Liderança
        </h2>
        <p className="text-[11px] font-black uppercase tracking-widest text-slate-400 mt-1">
          Acompanhamento contínuo de Say/Do ratio, Velocity e Carry-overs por Squad
        </p>
      </div>

      <Card className="border-slate-200 dark:border-slate-800/60 rounded-3xl bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
        <CardHeader className="p-6 border-b border-slate-100 dark:border-slate-800">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-primary/10 rounded-xl text-primary">
                <Target className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-lg font-black uppercase tracking-tight text-slate-900 dark:text-slate-100">
                  Filtro de Squad & Sprint
                </CardTitle>
                <CardDescription className="text-xs text-slate-400">
                  Consulte os dados consolidados da sprint ativa
                </CardDescription>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Select value={selectedSquadId} onValueChange={setSelectedSquadId}>
                <SelectTrigger className="w-[180px] h-10 rounded-xl text-xs font-bold">
                  <SelectValue placeholder="Selecione a Squad" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  {squads.map(s => (
                    <SelectItem key={s.id} value={s.id} className="text-xs font-bold">
                      {s.name} ({s.id})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Input 
                placeholder="ID da Sprint (ex: 1045)" 
                value={sprintId} 
                onChange={e => setSprintId(e.target.value)} 
                className="w-[180px] h-10 rounded-xl text-xs font-medium"
              />

              <Button onClick={fetchStats} disabled={loading} className="h-10 rounded-xl px-4 text-xs font-bold">
                <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
                Atualizar
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          {stats ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="p-6 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800 text-center">
                <p className="text-4xl font-black italic text-primary leading-none">{stats.velocityReal || stats.entregue || 0} pts</p>
                <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mt-3">Velocity Real Entregue</p>
              </div>
              <div className="p-6 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800 text-center">
                <p className="text-4xl font-black italic text-slate-900 dark:text-slate-100 leading-none">{stats.previsto || 0} pts</p>
                <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mt-3">Comprometido no Planner</p>
              </div>
              <div className="p-6 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800 text-center">
                <p className="text-4xl font-black italic text-amber-500 leading-none">{stats.carryOvers || 0} pts</p>
                <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mt-3">Carry-overs / Débitos</p>
              </div>
            </div>
          ) : (
            <div className="text-center py-12 text-slate-400">
              <p className="text-sm font-bold uppercase tracking-widest">Nenhum dado registrado para esta sprint</p>
              <p className="text-xs mt-1">Sincronize o projeto no Hub de Governança ou execute cerimônias vinculadas.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

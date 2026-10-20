import type { PlanItem, ScopeTotals, ScopeView, Thermometer } from '../../api';

/** `ItemView` do backend com todos os campos (valores neutros), para os testes mudarem só o que importa. */
export const planItem = (over: Partial<PlanItem> = {}): PlanItem => ({
  id: 'i1', parentKey: 'SQ-1', title: 'Checkout', titleDevHours: 18, titleQaHours: 6, sortOrder: 1, carryOver: false,
  devHours: 18, qaHours: 6, subtaskDevH: 16, subtaskQaH: 6, subtaskDevEstimateH: 16, subtaskDevRemainingH: 16,
  subtaskQaEstimateH: 6, subtaskQaRemainingH: 6, divergenceDev: false, divergenceQa: false, divergent: false,
  noEstimate: false, inBacklog: true, unclassifiedCount: 0, unclassifiedHours: 0, subtasks: [], ...over,
});

/** `ScopeTotals` calculado dos itens (só o necessário para os testes: contagem e horas que contam). */
export function scopeTotalsOf(items: readonly PlanItem[]): ScopeTotals {
  return {
    itemCount: items.length,
    allocated: { DEV: items.reduce((s, i) => s + i.devHours, 0), QA: items.reduce((s, i) => s + i.qaHours, 0) },
    carryOverCount: items.filter((i) => i.carryOver).length,
    carryOverDevHours: items.filter((i) => i.carryOver).reduce((s, i) => s + i.devHours, 0),
    carryOverQaHours: items.filter((i) => i.carryOver).reduce((s, i) => s + i.qaHours, 0),
    divergentCount: items.filter((i) => i.divergent).length,
    noEstimateCount: items.filter((i) => i.noEstimate).length,
    unclassifiedCount: items.reduce((s, i) => s + i.unclassifiedCount, 0),
    unclassifiedHours: items.reduce((s, i) => s + i.unclassifiedHours, 0),
    unclassifiedTypes: [],
  };
}

export function scopeViewOf(items: readonly PlanItem[], thermometer: Record<string, Thermometer>, over: Partial<ScopeView> = {}): ScopeView {
  return {
    planId: 'p1', status: 'ESCOPO', syncedAt: null, items: [...items], totals: scopeTotalsOf(items), thermometer, canEditPlan: true, ...over,
  };
}

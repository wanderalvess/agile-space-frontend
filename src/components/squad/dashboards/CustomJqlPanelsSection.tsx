"use client";

import React, { useState, useEffect, useCallback } from "react";
import { WidgetCard } from "./WidgetCard";
import { SimpleBarChart } from "./SimpleBarChart";
import {
  Plus,
  RefreshCw,
  Pencil,
  Trash2,
  Code2,
  PieChart as PieIcon,
  BarChart3,
  Hash,
  Table as TableIcon,
  Filter,
  Sparkles,
  Users2,
  Lock,
  Loader2,
  ExternalLink,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { useUser } from "@/context/UserContext";
import { useSquadDashboardData } from "@/hooks/useSquadDashboardData";
import { fetchJiraIssues } from "@/services/jiraService";
import { getJiraCredentials } from "@/hooks/useJiraSettings";
import { useToast } from "@/hooks/use-toast";

export interface CustomJqlPanel {
  id: string;
  title: string;
  jql: string;
  chartType: "number" | "table" | "bar" | "pie";
  groupBy?: "status" | "assignee" | "type" | "priority";
  visibility: "private" | "squad";
  resultTotal?: number;
  resultRows?: { label: string; value: number }[];
  resultIssues?: { key: string; title: string; status: string; type: string }[];
  lastUpdated?: string;
}

const DEFAULT_PANELS_TEMPLATES = (squadKey: string): CustomJqlPanel[] => [
  {
    id: "template-bugs",
    title: "Bugs Bloqueantes (Highest / High)",
    jql: `project = ${squadKey} AND type = Bug AND priority in (Highest, High)`,
    chartType: "number",
    visibility: "squad",
    resultTotal: 0,
  },
  {
    id: "template-status",
    title: "Distribuição da Sprint por Status",
    jql: `project = ${squadKey} AND sprint in openSprints()`,
    chartType: "pie",
    groupBy: "status",
    visibility: "squad",
    resultRows: [
      { label: "Done", value: 0 },
      { label: "In Progress", value: 0 },
      { label: "To Do", value: 0 },
    ],
  },
  {
    id: "template-assignee",
    title: "Itens por Responsável no Momento",
    jql: `project = ${squadKey} AND status != Done`,
    chartType: "bar",
    groupBy: "assignee",
    visibility: "squad",
    resultRows: [],
  },
  {
    id: "template-qa",
    title: "Fila de Homologação / Testes (QA)",
    jql: `project = ${squadKey} AND status in ('QA Testing', 'Homologação', 'In Review')`,
    chartType: "table",
    visibility: "squad",
    resultIssues: [],
  },
];

const THEME_PIE_COLORS = [
  "hsl(var(--primary))",
  "#22C55E",
  "#3B82F6",
  "#A855F7",
  "#EC4899",
  "#EAB308",
  "#06B6D4",
];

export function CustomJqlPanelsSection() {
  const { userProfile } = useUser();
  const { toast } = useToast();
  const squadId = userProfile?.squadId || "";
  const { issues: squadIssues, loading: squadLoading } = useSquadDashboardData();

  const storageKey = `agileSpace_custom_panels_${squadId}`;

  const [panels, setPanels] = useState<CustomJqlPanel[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPanelId, setEditingPanelId] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [jql, setJql] = useState(`project = ${squadId}`);
  const [chartType, setChartType] = useState<"number" | "table" | "bar" | "pie">("bar");
  const [groupBy, setGroupBy] = useState<"status" | "assignee" | "type" | "priority">("status");
  const [visibility, setVisibility] = useState<"private" | "squad">("squad");
  const [runningIds, setRunningIds] = useState<Set<string>>(new Set());

  // 1. Carregar painéis persistidos no localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setPanels(parsed);
          return;
        }
      }
    } catch (e) {
      console.warn("Erro ao ler painéis salvos:", e);
    }
    // Se não tiver painel salvo, inicializa com os templates
    const initial = DEFAULT_PANELS_TEMPLATES(squadId);
    setPanels(initial);
  }, [storageKey, squadId]);

  // 2. Salvar painéis no localStorage sempre que houver alteração
  const persistPanels = (newPanels: CustomJqlPanel[]) => {
    setPanels(newPanels);
    try {
      localStorage.setItem(storageKey, JSON.stringify(newPanels));
    } catch (e) {
      console.error("Erro ao salvar painéis customizados:", e);
    }
  };

  // 3. Execução real do painel JQL (via Jira API ou fallback inteligente nos dados da squad)
  const executePanelQuery = useCallback(
    async (panel: CustomJqlPanel): Promise<CustomJqlPanel> => {
      const creds = await getJiraCredentials(userProfile?.id || userProfile?.email || "");
      let matchedIssues: Array<{
        key: string;
        title: string;
        status: string;
        type: string;
        assignee?: string;
        priority?: string;
      }> = [];

      if (creds?.domain && creds?.token && panel.jql) {
        try {
          const res = await fetchJiraIssues(creds.domain, creds.token, panel.jql);
          if (Array.isArray(res)) {
            matchedIssues = res.map((i) => ({
              key: i.key,
              title: i.title || i.key,
              status: i.status,
              type: i.type,
              assignee: i.assignee || "Não Atribuído",
              priority: i.priority || "Medium",
            }));
          }
        } catch (err) {
          console.warn("Erro ao executar query direta no Jira, utilizando cache de squad:", err);
        }
      }

      // Fallback: Se não retornou via API externa, filtra os dados locais sincronizados do Jira
      if (matchedIssues.length === 0 && squadIssues.length > 0) {
        const jqlLower = panel.jql.toLowerCase();
        matchedIssues = squadIssues
          .filter((iss) => {
            if (jqlLower.includes("bug") && iss.type?.toLowerCase() !== "bug") return false;
            if (jqlLower.includes("done") && !jqlLower.includes("!=") && iss.status?.toLowerCase() !== "done") return false;
            if (jqlLower.includes("status != done") && iss.status?.toLowerCase() === "done") return false;
            return true;
          })
          .map((iss) => ({
            key: iss.jiraKey || iss.key,
            title: iss.title || iss.jiraKey || iss.key,
            status: iss.status,
            type: iss.type || "Story",
            assignee: iss.assigneeName || "Não Atribuído",
            // squad não rastreia prioridade (sem coluna correspondente na API) — fixo em "Medium"
            priority: "Medium",
          }));
      }

      const total = matchedIssues.length;
      let rows: { label: string; value: number }[] | undefined;
      let issueRows: { key: string; title: string; status: string; type: string }[] | undefined;

      if (panel.chartType === "bar" || panel.chartType === "pie") {
        const groupField = panel.groupBy || "status";
        const counts = new Map<string, number>();

        matchedIssues.forEach((iss) => {
          let key = "Outros";
          if (groupField === "status") key = iss.status || "Sem Status";
          else if (groupField === "assignee") key = iss.assignee || "Sem Responsável";
          else if (groupField === "type") key = iss.type || "Sem Tipo";
          else if (groupField === "priority") key = iss.priority || "Sem Prioridade";

          counts.set(key, (counts.get(key) || 0) + 1);
        });

        rows = Array.from(counts.entries()).map(([label, value]) => ({
          label,
          value,
        }));

        if (rows.length === 0) {
          rows = [{ label: "Sem registros", value: 0 }];
        }
      } else if (panel.chartType === "table") {
        issueRows = matchedIssues.slice(0, 10).map((i) => ({
          key: i.key,
          title: i.title,
          status: i.status,
          type: i.type,
        }));
      }

      return {
        ...panel,
        resultTotal: total,
        resultRows: rows,
        resultIssues: issueRows,
        lastUpdated: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
      };
    },
    [squadIssues]
  );

  const handleRefreshPanel = async (panelId: string) => {
    const target = panels.find((p) => p.id === panelId);
    if (!target) return;

    setRunningIds((prev) => new Set(prev).add(panelId));
    try {
      const updated = await executePanelQuery(target);
      const updatedList = panels.map((p) => (p.id === panelId ? updated : p));
      persistPanels(updatedList);
      toast({
        title: "Painel Atualizado",
        description: `Dados do painel "${target.title}" sincronizados com o Jira.`,
      });
    } catch (e) {
      toast({
        title: "Erro ao Atualizar",
        description: "Não foi possível sincronizar o painel no momento.",
        variant: "destructive",
      });
    } finally {
      setRunningIds((prev) => {
        const next = new Set(prev);
        next.delete(panelId);
        return next;
      });
    }
  };

  const handleSavePanel = async () => {
    if (!title.trim() || !jql.trim()) {
      toast({
        title: "Campos Obrigatórios",
        description: "Por favor, preencha o título e a consulta JQL.",
        variant: "destructive",
      });
      return;
    }

    const panelId = editingPanelId || `panel-${Date.now()}`;
    const basePanel: CustomJqlPanel = {
      id: panelId,
      title: title.trim(),
      jql: jql.trim(),
      chartType,
      groupBy: chartType === "bar" || chartType === "pie" ? groupBy : undefined,
      visibility,
    };

    setRunningIds((prev) => new Set(prev).add(panelId));
    setIsModalOpen(false);

    try {
      const resolved = await executePanelQuery(basePanel);
      let updatedList: CustomJqlPanel[];

      if (editingPanelId) {
        updatedList = panels.map((p) => (p.id === editingPanelId ? resolved : p));
      } else {
        updatedList = [resolved, ...panels];
      }

      persistPanels(updatedList);
      toast({
        title: "Painel Salvo",
        description: `O painel personalizado "${basePanel.title}" foi salvo com sucesso.`,
      });
    } catch (err) {
      const fallbackList = editingPanelId
        ? panels.map((p) => (p.id === editingPanelId ? basePanel : p))
        : [basePanel, ...panels];
      persistPanels(fallbackList);
    } finally {
      setRunningIds((prev) => {
        const next = new Set(prev);
        next.delete(panelId);
        return next;
      });
      resetForm();
    }
  };

  const handleEditClick = (panel: CustomJqlPanel) => {
    setEditingPanelId(panel.id);
    setTitle(panel.title);
    setJql(panel.jql);
    setChartType(panel.chartType);
    if (panel.groupBy) setGroupBy(panel.groupBy);
    setVisibility(panel.visibility);
    setIsModalOpen(true);
  };

  const handleDeletePanel = (id: string) => {
    const updated = panels.filter((p) => p.id !== id);
    persistPanels(updated);
    toast({
      title: "Painel Removido",
      description: "O painel customizado foi excluído.",
    });
  };

  const resetForm = () => {
    setEditingPanelId(null);
    setTitle("");
    setJql(`project = ${squadId}`);
    setChartType("bar");
    setGroupBy("status");
    setVisibility("squad");
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Header de Painéis Customizados */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white/80 dark:bg-slate-900/80 p-5 rounded-3xl border border-slate-200/60 dark:border-slate-800/60 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-primary/10 border border-primary/20 text-primary">
            <Code2 className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-black text-slate-900 dark:text-white uppercase tracking-wider font-headline">
                Painéis Personalizados por JQL (Consultas Ad-Hoc)
              </h2>
              <span className="bg-primary/10 text-primary font-bold text-[9px] px-2 py-0.5 rounded-full uppercase">
                Persistência Salva
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-medium">
              Crie, personalize e salve gráficos consultando diretamente as métricas do Jira da sua squad.
            </p>
          </div>
        </div>

        <Button
          onClick={() => {
            resetForm();
            setIsModalOpen(true);
          }}
          className="bg-primary hover:bg-primary/90 font-bold text-white text-xs px-4 py-2 rounded-2xl shadow-md shadow-primary/20 flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          Criar Painel JQL
        </Button>
      </div>

      {/* Grid de Cards de Painéis Personalizados */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6">
        {panels.map((panel) => {
          const isRunning = runningIds.has(panel.id);

          return (
            <div key={panel.id} className="relative group">
              <WidgetCard
                title={panel.title}
                headerIcon={
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-muted-foreground bg-muted px-2 py-0.5 rounded-md flex items-center gap-1 border border-border">
                      {panel.visibility === "squad" ? (
                        <Users2 className="h-3 w-3 text-primary" />
                      ) : (
                        <Lock className="h-3 w-3 text-muted-foreground" />
                      )}
                      {panel.visibility}
                    </span>

                    <button
                      onClick={() => handleRefreshPanel(panel.id)}
                      disabled={isRunning}
                      className="text-muted-foreground hover:text-primary transition-colors p-1"
                      title="Atualizar Dados do Jira"
                    >
                      <RefreshCw className={`h-3.5 w-3.5 ${isRunning ? "animate-spin text-primary" : ""}`} />
                    </button>

                    <button
                      onClick={() => handleEditClick(panel)}
                      className="text-muted-foreground hover:text-foreground transition-colors p-1"
                      title="Editar Painel"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>

                    <button
                      onClick={() => handleDeletePanel(panel.id)}
                      className="text-muted-foreground hover:text-destructive transition-colors p-1"
                      title="Excluir Painel"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                }
              >
                <div className="flex flex-col gap-3">
                  {/* JQL Label */}
                  <div className="bg-muted/50 p-2 rounded-lg border border-border font-mono text-[10.5px] text-muted-foreground truncate">
                    <span className="text-primary font-bold">JQL: </span>
                    {panel.jql}
                  </div>

                  {/* Render do Gráfico */}
                  {isRunning ? (
                    <div className="h-44 flex flex-col items-center justify-center gap-2 text-muted-foreground">
                      <Loader2 className="h-6 w-6 animate-spin text-primary" />
                      <span className="text-xs">Consultando Jira...</span>
                    </div>
                  ) : (
                    <>
                      {panel.chartType === "number" && (
                        <div className="py-6 flex flex-col items-center justify-center text-center">
                          <span className="text-6xl font-black text-foreground font-headline">
                            {panel.resultTotal ?? 0}
                          </span>
                          <span className="text-xs text-muted-foreground font-medium mt-2">
                            Issues encontradas no Jira
                          </span>
                        </div>
                      )}

                      {panel.chartType === "bar" && panel.resultRows && (
                        <SimpleBarChart
                          title=""
                          data={panel.resultRows.map((r) => ({ name: r.label, value: r.value }))}
                          defaultColor="hsl(var(--primary))"
                          height={190}
                        />
                      )}

                      {panel.chartType === "pie" && panel.resultRows && (
                        <div className="h-48 w-full relative flex items-center justify-center">
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Tooltip
                                contentStyle={{
                                  backgroundColor: "hsl(var(--card))",
                                  borderColor: "hsl(var(--border))",
                                  borderRadius: "10px",
                                  color: "hsl(var(--card-foreground))",
                                  fontSize: "12px",
                                }}
                              />
                              <Pie
                                data={panel.resultRows}
                                cx="50%"
                                cy="50%"
                                outerRadius={68}
                                innerRadius={35}
                                paddingAngle={3}
                                dataKey="value"
                                stroke="none"
                              >
                                {panel.resultRows.map((entry, idx) => (
                                  <Cell
                                    key={`cell-${idx}`}
                                    fill={THEME_PIE_COLORS[idx % THEME_PIE_COLORS.length]}
                                  />
                                ))}
                              </Pie>
                            </PieChart>
                          </ResponsiveContainer>
                          <div className="absolute right-2 bottom-1 flex flex-col gap-1 text-[10px] text-muted-foreground max-w-[130px] truncate">
                            {panel.resultRows.slice(0, 4).map((r, i) => (
                              <div key={i} className="flex items-center gap-1.5 truncate">
                                <span
                                  className="h-2 w-2 rounded-full shrink-0"
                                  style={{
                                    backgroundColor:
                                      THEME_PIE_COLORS[i % THEME_PIE_COLORS.length],
                                  }}
                                />
                                <span className="truncate">{r.label}:</span>
                                <span className="font-bold text-foreground">{r.value}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {panel.chartType === "table" && (
                        <div className="overflow-x-auto max-h-52 border border-border rounded-xl">
                          <table className="w-full text-left text-xs">
                            <thead className="bg-muted text-muted-foreground border-b border-border uppercase font-semibold text-[10px]">
                              <tr>
                                <th className="p-2.5">Chave</th>
                                <th className="p-2.5">Resumo</th>
                                <th className="p-2.5">Status</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                              {panel.resultIssues && panel.resultIssues.length > 0 ? (
                                panel.resultIssues.map((iss) => (
                                  <tr key={iss.key} className="hover:bg-muted/40 transition-colors">
                                    <td className="p-2.5 font-mono font-bold text-primary whitespace-nowrap">
                                      {iss.key}
                                    </td>
                                    <td className="p-2.5 font-medium text-foreground truncate max-w-[200px]">
                                      {iss.title}
                                    </td>
                                    <td className="p-2.5">
                                      <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-bold">
                                        {iss.status}
                                      </span>
                                    </td>
                                  </tr>
                                ))
                              ) : (
                                <tr>
                                  <td colSpan={3} className="p-4 text-center text-muted-foreground text-xs">
                                    Nenhuma issue encontrada para esta query.
                                  </td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </>
                  )}

                  {panel.lastUpdated && (
                    <div className="text-[10px] text-muted-foreground text-right mt-1">
                      Atualizado às {panel.lastUpdated}
                    </div>
                  )}
                </div>
              </WidgetCard>
            </div>
          );
        })}
      </div>

      {/* Modal de Criação / Edição de Painel JQL */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="bg-card border-border text-card-foreground max-w-lg rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-black uppercase tracking-wider text-foreground flex items-center gap-2">
              <Code2 className="h-5 w-5 text-primary" />
              {editingPanelId ? "Editar Painel JQL" : "Novo Painel Customizado (JQL)"}
            </DialogTitle>
          </DialogHeader>

          <div className="flex flex-col gap-4 py-2">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-muted-foreground uppercase">Título do Painel</label>
              <Input
                placeholder="Ex: Bugs Críticos em Aberto"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="bg-muted border-border text-foreground rounded-xl"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-muted-foreground uppercase">Consulta JQL do Jira</label>
              <Input
                placeholder={`project = ${squadId} AND type = Bug`}
                value={jql}
                onChange={(e) => setJql(e.target.value)}
                className="bg-muted border-border text-foreground font-mono text-xs rounded-xl"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-muted-foreground uppercase">Tipo de Gráfico</label>
                <Select value={chartType} onValueChange={(val: any) => setChartType(val)}>
                  <SelectTrigger className="bg-muted border-border text-foreground rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border text-card-foreground rounded-xl">
                    <SelectItem value="bar">Gráfico de Barras</SelectItem>
                    <SelectItem value="pie">Gráfico de Pizza</SelectItem>
                    <SelectItem value="number">Contador Numérico</SelectItem>
                    <SelectItem value="table">Tabela de Itens</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {(chartType === "bar" || chartType === "pie") && (
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-muted-foreground uppercase">Agrupar Por</label>
                  <Select value={groupBy} onValueChange={(val: any) => setGroupBy(val)}>
                    <SelectTrigger className="bg-muted border-border text-foreground rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-card border-border text-card-foreground rounded-xl">
                      <SelectItem value="status">Status</SelectItem>
                      <SelectItem value="assignee">Responsável</SelectItem>
                      <SelectItem value="type">Tipo de Item</SelectItem>
                      <SelectItem value="priority">Prioridade</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-muted-foreground uppercase">Visibilidade</label>
                <Select value={visibility} onValueChange={(val: any) => setVisibility(val)}>
                  <SelectTrigger className="bg-muted border-border text-foreground rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border text-card-foreground rounded-xl">
                    <SelectItem value="squad">Toda a Squad</SelectItem>
                    <SelectItem value="private">Privado (Apenas Eu)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0 mt-4">
            <Button
              variant="outline"
              onClick={() => setIsModalOpen(false)}
              className="border-border text-muted-foreground hover:bg-muted rounded-xl"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSavePanel}
              className="bg-primary text-primary-foreground font-bold rounded-xl"
            >
              Salvar Painel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

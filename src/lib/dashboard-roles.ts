/** Ids das abas do painel por papel. Os mesmos nomes das antigas rotas /squad/dashboards/<id>. */
export type DashboardTabId =
  | "custom"
  | "member"
  | "product-owner"
  | "agile-master"
  | "people-lead"
  | "tech-lead"
  | "tribe-level";

export type DashboardTab = {
  id: DashboardTabId;
  label: string;
  shortLabel: string;
  href: string;
  roles: string[];
  description: string;
};

export const ALL_DASHBOARD_TABS: DashboardTab[] = [
  {
    id: "custom",
    label: "Consultas do Jira (JQL)",
    shortLabel: "JQL",
    href: "/squad/dashboards/custom",
    roles: ["*"], // Todos têm acesso aos painéis personalizados
    description: "Consultas JQL personalizadas e métricas sob demanda",
  },
  {
    id: "member",
    label: "Execução (Dev, QA e UX)",
    shortLabel: "Membro",
    href: "/squad/dashboards/member",
    roles: [
      "Developer",
      "QA",
      "Designer",
      "UX",
      "SME",
      "Stakeholder / Observador",
      "Desenvolvedor(a)",
      "Analista de QA",
      "Designer / UI-UX",
      "user",
    ],
    description: "Execução operacional, tarefas atribuídas e horas diárias",
  },
  {
    id: "product-owner",
    label: "Product Owner",
    shortLabel: "PO",
    href: "/squad/dashboards/product-owner",
    roles: ["Product Owner", "Product Owner (PO)"],
    description: "Visão de valor de produto, fluxo de épicos e saúde do backlog",
  },
  {
    id: "agile-master",
    label: "Agile Master",
    shortLabel: "AM",
    href: "/squad/dashboards/agile-master",
    roles: [
      "Agile Master",
      "Scrum Master",
      "Agile Coach",
      "Scrum Master / Agile Coach",
    ],
    description: "Governança de cerimônias, impedimentos e métricas de fluxo",
  },
  {
    id: "people-lead",
    label: "People Lead",
    shortLabel: "PL",
    href: "/squad/dashboards/people-lead",
    roles: ["People Lead"],
    description: "Capacidade, distribuição de carga e engajamento do time",
  },
  {
    id: "tech-lead",
    label: "Tech Lead",
    shortLabel: "TL",
    href: "/squad/dashboards/tech-lead",
    roles: ["Tech Lead", "Arquiteto(a) / Tech Lead"],
    description: "Qualidade técnica, bugs, débito técnico e fila de revisão e testes",
  },
  {
    id: "tribe-level",
    label: "Tribo (várias squads)",
    shortLabel: "Tribe",
    href: "/squad/dashboards/tribe-level",
    roles: ["Tribe Lead", "admin"],
    description: "Visão consolidada de todas as squads da tribo",
  },
];

const LEADERSHIP_AND_ADMIN_ROLES = [
  "admin",
  "Tribe Lead",
  "Agile Coach",
  "Scrum Master / Agile Coach",
  "Agile Master",
];

export function isUserLeadershipOrAdmin(role?: string | null): boolean {
  if (!role) return false;
  const normalized = role.toLowerCase().trim();
  return LEADERSHIP_AND_ADMIN_ROLES.some((r) => r.toLowerCase() === normalized);
}

export function getDashboardRouteForRole(role?: string | null): string {
  if (!role) return "/squad/dashboards/member";

  const normalized = role.toLowerCase().trim();

  if (normalized.includes("tribe") || normalized === "admin") {
    return "/squad/dashboards/tribe-level";
  }
  if (normalized.includes("product") || normalized === "po") {
    return "/squad/dashboards/product-owner";
  }
  if (
    normalized.includes("tech lead") ||
    normalized.includes("arquiteto") ||
    normalized === "tl"
  ) {
    return "/squad/dashboards/tech-lead";
  }
  if (normalized.includes("people") || normalized === "pl") {
    return "/squad/dashboards/people-lead";
  }
  if (
    normalized.includes("agile") ||
    normalized.includes("scrum") ||
    normalized === "am"
  ) {
    return "/squad/dashboards/agile-master";
  }

  return "/squad/dashboards/member";
}

export function getAllowedDashboardTabs(
  role?: string | null,
  isLeadershipOverride?: boolean
): DashboardTab[] {
  const isSuperUser = isLeadershipOverride || isUserLeadershipOrAdmin(role);

  // Superusuários/Liderança têm acesso a todas as abas
  if (isSuperUser) {
    return ALL_DASHBOARD_TABS;
  }

  const userDefaultRoute = getDashboardRouteForRole(role);

  // Usuários comuns veem o painel JQL (Custom) e o painel específico do seu papel
  return ALL_DASHBOARD_TABS.filter(
    (tab) => tab.href === "/squad/dashboards/custom" || tab.href === userDefaultRoute
  );
}

export function canUserAccessDashboard(
  role?: string | null,
  pathname?: string,
  isLeadershipOverride?: boolean
): boolean {
  if (!pathname) return true;
  if (pathname === "/squad/dashboards" || pathname === "/squad/dashboards/custom") {
    return true;
  }

  const isSuperUser = isLeadershipOverride || isUserLeadershipOrAdmin(role);
  if (isSuperUser) return true;

  const allowedTabs = getAllowedDashboardTabs(role, isLeadershipOverride);
  return allowedTabs.some((tab) => pathname.startsWith(tab.href));
}

// ---------------------------------------------------------------------------------------------------------------------
// Painel único por papel (Squad Hub > Painéis). As rotas /squad/dashboards/* viraram atalhos: o `href` de cada aba
// continua sendo a rota antiga (que redireciona), e o id é o valor de `?papel=` na URL nova.
// O controle por papel é SÓ de interface: o servidor libera rollup, issues e membros a qualquer membro da squad.
// ---------------------------------------------------------------------------------------------------------------------

export const PANELS_PAPEL_PARAM = "papel";

const TAB_IDS: DashboardTabId[] = ALL_DASHBOARD_TABS.map((t) => t.id);

export function isDashboardTabId(value: unknown): value is DashboardTabId {
  return typeof value === "string" && (TAB_IDS as string[]).includes(value);
}

/** Valor de `?papel=` -> id da aba. Aceita "jql" como apelido de "custom". Valor desconhecido -> null. */
export function parsePapelParam(value?: string | null): DashboardTabId | null {
  const v = (value || "").trim().toLowerCase();
  if (v === "jql") return "custom";
  return isDashboardTabId(v) ? v : null;
}

/** URL do painel único. Sem id, abre o painel do papel de quem está logado. */
export function getPanelsUrl(tabId?: DashboardTabId | null): string {
  return tabId ? `/squad?tab=paineis&${PANELS_PAPEL_PARAM}=${tabId}` : "/squad?tab=paineis";
}

/** Id da aba que é o painel do papel (o que abre primeiro). */
export function getDashboardTabIdForRole(role?: string | null): DashboardTabId {
  return getDashboardRouteForRole(role).replace("/squad/dashboards/", "") as DashboardTabId;
}

export interface PanelsAccess {
  /** Abas que a pessoa vê, na ordem da barra. */
  tabs: DashboardTab[];
  /** Painel do papel dela: abre primeiro e é o destino de "Abrir o painel do meu papel". */
  defaultTabId: DashboardTabId;
  /** Vê todas as abas (liderança/admin): mostra a etiqueta "Visão de liderança". */
  isLeadershipView: boolean;
}

/**
 * Quem vê qual aba. `isLeadership` é o sinal do UserContext (PO, Agile Master, People Lead, Tech Lead, Tribe Lead,
 * Agile Coach, SME e admin); sozinho, o papel só libera todas as abas para Agile Master, Agile Coach, Tribe Lead e admin.
 */
export function resolvePanelsAccess(role?: string | null, isLeadership?: boolean): PanelsAccess {
  const isLeadershipView = !!isLeadership || isUserLeadershipOrAdmin(role);
  return {
    tabs: getAllowedDashboardTabs(role, isLeadershipView),
    defaultTabId: getDashboardTabIdForRole(role),
    isLeadershipView,
  };
}

export interface ActivePanelTab {
  tabId: DashboardTabId;
  /** O painel pedido (pela URL) é de outro papel: mostra "Este painel é de outro papel" em vez dos números. */
  denied: boolean;
}

/** Aba aberta: a pedida se existir e a pessoa puder vê-la; sem pedido válido, o painel do próprio papel. */
export function resolveActivePanelTab(requested: string | null | undefined, access: PanelsAccess): ActivePanelTab {
  const wanted = parsePapelParam(requested);
  if (!wanted) return { tabId: access.defaultTabId, denied: false };
  const allowed = wanted === "custom" || access.tabs.some((t) => t.id === wanted);
  return { tabId: wanted, denied: !allowed };
}

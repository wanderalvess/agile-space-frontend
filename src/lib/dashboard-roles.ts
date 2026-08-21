export type DashboardTab = {
  id: string;
  label: string;
  shortLabel: string;
  href: string;
  roles: string[];
  description: string;
};

export const ALL_DASHBOARD_TABS: DashboardTab[] = [
  {
    id: "custom",
    label: "PAINÉIS JQL (JIRA)",
    shortLabel: "JQL",
    href: "/squad/dashboards/custom",
    roles: ["*"], // Todos têm acesso aos painéis personalizados
    description: "Consultas JQL customizadas e métricas sob demanda",
  },
  {
    id: "member",
    label: "DEV / QA / UX",
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
    description: "Execução operacional, tarefas atribuídas e worklogs diários",
  },
  {
    id: "product-owner",
    label: "PRODUCT OWNER",
    shortLabel: "PO",
    href: "/squad/dashboards/product-owner",
    roles: ["Product Owner", "Product Owner (PO)"],
    description: "Visão de valor de produto, fluxo de épicos e saúde do backlog",
  },
  {
    id: "agile-master",
    label: "AGILE MASTER",
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
    label: "PEOPLE LEAD",
    shortLabel: "PL",
    href: "/squad/dashboards/people-lead",
    roles: ["People Lead"],
    description: "Capacidade, distribuição de carga e engajamento do time",
  },
  {
    id: "tech-lead",
    label: "TECH LEAD",
    shortLabel: "TL",
    href: "/squad/dashboards/tech-lead",
    roles: ["Tech Lead", "Arquiteto(a) / Tech Lead"],
    description: "Qualidade técnica, bugs críticos, débitos e PRs",
  },
  {
    id: "tribe-level",
    label: "TRIBE / MULTI-SQUAD",
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

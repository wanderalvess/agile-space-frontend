import { redirect } from "next/navigation";

// Atalho antigo: o painel único (Squad Hub > Painéis) abre sozinho no painel do papel de quem está logado.
export default function SquadDashboardsLegacyRedirect() {
  redirect("/squad?tab=paineis");
}

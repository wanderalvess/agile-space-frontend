import { redirect } from "next/navigation";

// O painel de cada papel agora é uma aba do painel único em Squad Hub > Painéis. Esta rota fica como atalho.
export default function TribeLevelDashboardLegacyRedirect() {
  redirect("/squad?tab=paineis&papel=tribe-level");
}

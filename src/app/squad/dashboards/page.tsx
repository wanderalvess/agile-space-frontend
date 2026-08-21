"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/context/UserContext";
import { getDashboardRouteForRole } from "@/lib/dashboard-roles";
import { Loader2 } from "lucide-react";

export default function SquadDashboardsIndexPage() {
  const router = useRouter();
  const { userProfile, isInitializing, isLeadership } = useUser();

  useEffect(() => {
    if (!isInitializing) {
      const targetRoute = getDashboardRouteForRole(userProfile?.role);
      router.replace(targetRoute);
    }
  }, [userProfile, isInitializing, router]);

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 text-muted-foreground">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
      <p className="text-sm font-medium">Carregando painel do seu cargo...</p>
    </div>
  );
}

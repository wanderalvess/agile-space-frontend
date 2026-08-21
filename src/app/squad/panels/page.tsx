"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function SquadPanelsRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/squad/dashboards/custom");
  }, [router]);

  return null;
}

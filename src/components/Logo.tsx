import { cn } from "@/lib/utils";
import { Rocket } from "lucide-react";

export function Logo({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center justify-center shrink-0 rounded-xl", className)}>
      <Rocket className="w-full h-full text-current" />
    </div>
  );
}

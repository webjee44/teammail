import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";

type SyncStatus = "fresh" | "stale" | "error" | "scanning" | "unknown";

interface SyncHealthIndicatorProps {
  lastSuccessfulSyncAt: string | null;
  lastErrorAt: string | null;
  lastErrorMessage: string | null;
  syncMode: string | null;
}

function getSyncStatus(props: SyncHealthIndicatorProps): { status: SyncStatus; label: string } {
  const { lastSuccessfulSyncAt, lastErrorAt, syncMode } = props;

  if (syncMode === "full_scan") {
    return { status: "scanning", label: "Scan initial en cours…" };
  }

  if (!lastSuccessfulSyncAt) {
    return { status: "unknown", label: "Aucune sync réussie" };
  }

  const successDate = new Date(lastSuccessfulSyncAt);
  const errorDate = lastErrorAt ? new Date(lastErrorAt) : null;
  const ageMinutes = (Date.now() - successDate.getTime()) / 60_000;

  // If there's an error more recent than last success
  if (errorDate && errorDate > successDate) {
    return { status: "error", label: `Erreur sync — dernière réussite il y a ${Math.round(ageMinutes)} min` };
  }

  if (ageMinutes < 5) {
    return { status: "fresh", label: `Sync OK — il y a ${Math.round(ageMinutes)} min` };
  }

  if (ageMinutes < 15) {
    return { status: "stale", label: `Sync en retard — il y a ${Math.round(ageMinutes)} min` };
  }

  return { status: "error", label: `Sync très en retard — il y a ${Math.round(ageMinutes)} min` };
}

const statusColors: Record<SyncStatus, string> = {
  fresh: "bg-green-500",
  stale: "bg-amber-500",
  error: "bg-destructive",
  scanning: "bg-amber-500 animate-pulse",
  unknown: "bg-muted-foreground/40",
};

export function SyncHealthIndicator(props: SyncHealthIndicatorProps) {
  const { status, label } = getSyncStatus(props);

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className={`inline-block w-2 h-2 rounded-full shrink-0 ${statusColors[status]}`} />
        </TooltipTrigger>
        <TooltipContent side="right" className="text-xs max-w-[220px]">
          <p>{label}</p>
          {props.lastErrorMessage && status === "error" && (
            <p className="text-destructive mt-1 truncate">{props.lastErrorMessage}</p>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

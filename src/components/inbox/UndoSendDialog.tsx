import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, X } from "lucide-react";

type Props = {
  open: boolean;
  delaySeconds?: number;
  onCancel: () => void;
  onExpire: () => void;
};

export function UndoSendDialog({ open, delaySeconds = 15, onCancel, onExpire }: Props) {
  const [remaining, setRemaining] = useState(delaySeconds);
  const expiredRef = useRef(false);

  useEffect(() => {
    if (!open) {
      setRemaining(delaySeconds);
      expiredRef.current = false;
      return;
    }

    setRemaining(delaySeconds);
    expiredRef.current = false;

    const interval = setInterval(() => {
      setRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          if (!expiredRef.current) {
            expiredRef.current = true;
            setTimeout(onExpire, 0);
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [open, delaySeconds, onExpire]);

  if (!open) return null;

  const progress = remaining / delaySeconds;

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-4 fade-in duration-300">
      <div className="flex items-center gap-3 bg-foreground text-background rounded-lg px-4 py-2.5 shadow-lg min-w-[280px]">
        {/* Progress bar background */}
        <div className="absolute inset-0 rounded-lg overflow-hidden pointer-events-none">
          <div
            className="absolute inset-y-0 left-0 bg-background/10 transition-[width] duration-1000 ease-linear"
            style={{ width: `${progress * 100}%` }}
          />
        </div>

        <span className="text-sm font-medium relative z-10">
          {remaining === 0 ? "Envoi en cours…" : "Message envoyé."}
        </span>

        <div className="flex items-center gap-2 ml-auto relative z-10">
          {remaining > 0 ? (
            <Button
              variant="link"
              size="sm"
              className="text-background hover:text-background/80 font-semibold px-1 h-auto"
              onClick={onCancel}
            >
              Annuler
            </Button>
          ) : (
            <Loader2 className="h-4 w-4 animate-spin" />
          )}
        </div>

        {remaining > 0 && (
          <span className="text-xs tabular-nums text-background/60 relative z-10">
            {remaining}s
          </span>
        )}
      </div>
    </div>
  );
}

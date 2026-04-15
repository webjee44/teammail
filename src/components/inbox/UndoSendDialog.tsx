import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

type Props = {
  open: boolean;
  delaySeconds?: number;
  onCancel: () => void;
  onExpire: () => void;
};

export function UndoSendDialog({ open, delaySeconds = 5, onCancel, onExpire }: Props) {
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
  const circumference = 2 * Math.PI * 14;
  const strokeOffset = circumference * (1 - progress);

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-4 fade-in duration-300">
      <div className="flex items-center gap-3 bg-foreground text-background rounded-lg px-4 py-2.5 shadow-lg min-w-[300px]">
        {/* Progress bar background */}
        <div className="absolute inset-0 rounded-lg overflow-hidden pointer-events-none">
          <div
            className="absolute inset-y-0 left-0 bg-background/10 transition-[width] duration-1000 ease-linear"
            style={{ width: `${progress * 100}%` }}
          />
        </div>

        {/* Circular countdown */}
        <div className="relative z-10 shrink-0 flex items-center justify-center w-8 h-8">
          {remaining > 0 ? (
            <>
              <svg className="w-8 h-8 -rotate-90" viewBox="0 0 32 32">
                <circle cx="16" cy="16" r="14" fill="none" stroke="currentColor" strokeWidth="2" className="opacity-20" />
                <circle
                  cx="16" cy="16" r="14" fill="none" stroke="currentColor" strokeWidth="2"
                  strokeDasharray={circumference}
                  strokeDashoffset={strokeOffset}
                  strokeLinecap="round"
                  className="transition-[stroke-dashoffset] duration-1000 ease-linear"
                />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-[11px] font-bold tabular-nums">
                {remaining}
              </span>
            </>
          ) : (
            <Loader2 className="h-5 w-5 animate-spin" />
          )}
        </div>

        <span className="text-sm font-medium relative z-10">
          {remaining === 0 ? "Envoi en cours…" : "Message envoyé"}
        </span>

        {remaining > 0 && (
          <Button
            variant="link"
            size="sm"
            className="text-background hover:text-background/80 font-semibold px-1 h-auto ml-auto relative z-10"
            onClick={onCancel}
          >
            Annuler
          </Button>
        )}
      </div>
    </div>
  );
}

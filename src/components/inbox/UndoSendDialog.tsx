import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
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
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (!open) {
      setRemaining(delaySeconds);
      expiredRef.current = false;
      return;
    }

    setRemaining(delaySeconds);
    expiredRef.current = false;

    intervalRef.current = setInterval(() => {
      setRemaining((prev) => {
        if (prev <= 1) {
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
          }

          if (!expiredRef.current) {
            expiredRef.current = true;
            setTimeout(onExpire, 0);
          }

          return 0;
        }

        return prev - 1;
      });
    }, 1000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [open, delaySeconds, onExpire]);

  if (!open) return null;

  const handleCancelClick = () => {
    expiredRef.current = true;
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    onCancel();
  };

  const progress = remaining / delaySeconds;
  const circumference = 2 * Math.PI * 14;
  const strokeOffset = circumference * (1 - progress);

  return createPortal(
    <div className="fixed inset-x-0 bottom-4 z-[200] flex justify-center animate-in slide-in-from-bottom-4 fade-in duration-300">
      <div className="relative flex items-center gap-3 rounded-lg bg-foreground px-4 py-2.5 text-background shadow-lg min-w-[300px]">
        <div className="absolute inset-0 overflow-hidden rounded-lg pointer-events-none">
          <div
            className="absolute inset-y-0 left-0 bg-background/10 transition-[width] duration-1000 ease-linear"
            style={{ width: `${progress * 100}%` }}
          />
        </div>

        <div className="relative z-10 flex h-8 w-8 shrink-0 items-center justify-center">
          {remaining > 0 ? (
            <>
              <svg className="h-8 w-8 -rotate-90" viewBox="0 0 32 32">
                <circle cx="16" cy="16" r="14" fill="none" stroke="currentColor" strokeWidth="2" className="opacity-20" />
                <circle
                  cx="16"
                  cy="16"
                  r="14"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
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

        <span className="relative z-10 text-sm font-medium">
          {remaining === 0 ? "Envoi en cours…" : "Message envoyé"}
        </span>

        {remaining > 0 && (
          <button
            type="button"
            className="relative z-10 ml-auto text-sm font-semibold text-background transition-opacity hover:opacity-80"
            onClick={handleCancelClick}
          >
            Annuler
          </button>
        )}
      </div>
    </div>,
    document.body,
  );
}

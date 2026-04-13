import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

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

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent
        className="sm:max-w-sm gap-4"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogTitle className="sr-only">Annuler l'envoi</DialogTitle>
        <div className="flex flex-col items-center gap-4 py-2">
          <div className="relative h-14 w-14 flex items-center justify-center">
            <svg className="absolute inset-0 h-14 w-14 -rotate-90" viewBox="0 0 56 56">
              <circle cx="28" cy="28" r="24" fill="none" stroke="hsl(var(--muted))" strokeWidth="4" />
              <circle
                cx="28"
                cy="28"
                r="24"
                fill="none"
                stroke="hsl(var(--primary))"
                strokeWidth="4"
                strokeLinecap="round"
                strokeDasharray={2 * Math.PI * 24}
                strokeDashoffset={2 * Math.PI * 24 * (1 - remaining / delaySeconds)}
                className="transition-[stroke-dashoffset] duration-1000 ease-linear"
              />
            </svg>
            <span className="text-lg font-semibold tabular-nums">{remaining}</span>
          </div>
          <p className="text-sm text-muted-foreground text-center">
            L'email sera envoyé dans {remaining}s
          </p>
          <Button
            variant="destructive"
            className="w-full"
            onClick={onCancel}
            disabled={remaining === 0}
          >
            {remaining === 0 ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Envoi en cours…
              </>
            ) : (
              "Annuler l'envoi"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

import { useState } from "react";
import { X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type Props = {
  to: string;
  cc: string[];
  bcc: string[];
  onCcChange: (cc: string[]) => void;
  onBccChange: (bcc: string[]) => void;
};

function EmailChips({
  label,
  emails,
  onChange,
}: {
  label: string;
  emails: string[];
  onChange: (emails: string[]) => void;
}) {
  const [input, setInput] = useState("");

  const addEmail = () => {
    const trimmed = input.trim().toLowerCase();
    if (trimmed && trimmed.includes("@") && !emails.includes(trimmed)) {
      onChange([...emails, trimmed]);
      setInput("");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addEmail();
    }
    if (e.key === "Backspace" && !input && emails.length > 0) {
      onChange(emails.slice(0, -1));
    }
  };

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 border-b border-border">
      <span className="text-xs text-muted-foreground font-medium min-w-[28px]">{label}</span>
      <div className="flex flex-wrap items-center gap-1 flex-1">
        {emails.map((email) => (
          <Badge key={email} variant="secondary" className="text-xs gap-1 py-0 h-5">
            {email}
            <button
              onClick={() => onChange(emails.filter((e) => e !== email))}
              className="ml-0.5 hover:text-destructive"
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ))}
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={addEmail}
          placeholder="email@exemple.com"
          className="border-0 shadow-none h-6 text-xs px-1 focus-visible:ring-0 min-w-[140px] flex-1"
        />
      </div>
    </div>
  );
}

export function RecipientFields({ to, cc, bcc, onCcChange, onBccChange }: Props) {
  const [showCc, setShowCc] = useState(cc.length > 0);
  const [showBcc, setShowBcc] = useState(bcc.length > 0);

  return (
    <div className="border-b border-border">
      {/* To line */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-border">
        <div className="flex items-center gap-2 text-xs">
          <span className="text-muted-foreground font-medium">À :</span>
          <span className="text-foreground">{to}</span>
        </div>
        <div className="flex gap-1">
          {!showCc && (
            <Button variant="ghost" size="sm" className="h-5 text-xs px-1.5 text-muted-foreground" onClick={() => setShowCc(true)}>
              Cc
            </Button>
          )}
          {!showBcc && (
            <Button variant="ghost" size="sm" className="h-5 text-xs px-1.5 text-muted-foreground" onClick={() => setShowBcc(true)}>
              Cci
            </Button>
          )}
        </div>
      </div>

      {showCc && <EmailChips label="Cc :" emails={cc} onChange={onCcChange} />}
      {showBcc && <EmailChips label="Cci :" emails={bcc} onChange={onBccChange} />}
    </div>
  );
}

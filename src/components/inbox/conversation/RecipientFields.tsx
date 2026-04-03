import { useState, useEffect, useRef } from "react";
import { X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";

type Contact = {
  id: string;
  email: string;
  name: string | null;
  avatar_url: string | null;
};

type Props = {
  to: string;
  cc: string[];
  bcc: string[];
  onToChange?: (to: string) => void;
  onCcChange: (cc: string[]) => void;
  onBccChange: (bcc: string[]) => void;
};

function EmailChipsWithSearch({
  label,
  emails,
  onChange,
  singleValue,
  onSingleChange,
}: {
  label: string;
  emails?: string[];
  onChange?: (emails: string[]) => void;
  singleValue?: string;
  onSingleChange?: (v: string) => void;
}) {
  const [input, setInput] = useState(singleValue && !emails ? singleValue : "");
  const [suggestions, setSuggestions] = useState<Contact[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Keep single value in sync
  useEffect(() => {
    if (singleValue !== undefined && !emails) {
      setInput(singleValue);
    }
  }, [singleValue, emails]);

  // Search contacts
  useEffect(() => {
    const q = input.trim();
    if (q.length < 2) {
      setSuggestions([]);
      return;
    }
    const timer = setTimeout(async () => {
      const { data } = await supabase
        .from("contacts")
        .select("id, email, name, avatar_url")
        .or(`email.ilike.%${q}%,name.ilike.%${q}%`)
        .limit(6);
      // Filter out already-selected emails
      const existing = emails || (singleValue ? [singleValue] : []);
      setSuggestions((data || []).filter((c) => !existing.includes(c.email)));
    }, 200);
    return () => clearTimeout(timer);
  }, [input, emails, singleValue]);

  // Close suggestions on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const selectContact = (email: string) => {
    if (emails && onChange) {
      if (!emails.includes(email)) onChange([...emails, email]);
      setInput("");
    } else if (onSingleChange) {
      onSingleChange(email);
      setInput(email);
    }
    setSuggestions([]);
    setShowSuggestions(false);
    setSelectedIdx(-1);
  };

  const addRawEmail = () => {
    const trimmed = input.trim().toLowerCase();
    if (!trimmed || !trimmed.includes("@")) return;
    if (emails && onChange) {
      if (!emails.includes(trimmed)) onChange([...emails, trimmed]);
      setInput("");
    } else if (onSingleChange) {
      onSingleChange(trimmed);
    }
    setSuggestions([]);
    setShowSuggestions(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (showSuggestions && suggestions.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIdx((prev) => (prev < suggestions.length - 1 ? prev + 1 : 0));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIdx((prev) => (prev > 0 ? prev - 1 : suggestions.length - 1));
        return;
      }
      if (e.key === "Enter" && selectedIdx >= 0) {
        e.preventDefault();
        selectContact(suggestions[selectedIdx].email);
        return;
      }
    }
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addRawEmail();
    }
    if (e.key === "Backspace" && !input && emails && emails.length > 0 && onChange) {
      onChange(emails.slice(0, -1));
    }
  };

  return (
    <div ref={containerRef} className="relative flex items-center gap-2 px-3 py-1.5 border-b border-border">
      <span className="text-xs text-muted-foreground font-medium min-w-[28px]">{label}</span>
      <div className="flex flex-wrap items-center gap-1 flex-1">
        {emails?.map((email) => (
          <Badge key={email} variant="secondary" className="text-xs gap-1 py-0 h-5">
            {email}
            <button
              onClick={() => onChange?.(emails.filter((e) => e !== email))}
              className="ml-0.5 hover:text-destructive"
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ))}
        <Input
          ref={inputRef}
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            setShowSuggestions(true);
            setSelectedIdx(-1);
            if (onSingleChange) onSingleChange(e.target.value);
          }}
          onKeyDown={handleKeyDown}
          onFocus={() => input.length >= 2 && setShowSuggestions(true)}
          onBlur={() => {
            // Delay to allow click on suggestion
            setTimeout(() => addRawEmail(), 150);
          }}
          placeholder="Rechercher un contact ou saisir un email..."
          className="border-0 shadow-none h-6 text-xs px-1 focus-visible:ring-0 min-w-[200px] flex-1"
        />
      </div>

      {/* Suggestions dropdown */}
      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute left-0 top-full z-50 w-full bg-popover border border-border rounded-md shadow-lg py-1 max-h-48 overflow-y-auto">
          {suggestions.map((contact, idx) => {
            const initials = contact.name
              ? contact.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
              : contact.email.slice(0, 2).toUpperCase();
            return (
              <button
                key={contact.id}
                onMouseDown={(e) => {
                  e.preventDefault();
                  selectContact(contact.email);
                }}
                className={`w-full flex items-center gap-2 px-3 py-1.5 text-left hover:bg-accent/50 transition-colors ${
                  idx === selectedIdx ? "bg-accent/50" : ""
                }`}
              >
                <Avatar className="h-5 w-5">
                  <AvatarFallback className="text-[9px] bg-muted">{initials}</AvatarFallback>
                </Avatar>
                <div className="flex flex-col min-w-0">
                  {contact.name && (
                    <span className="text-xs font-medium text-foreground truncate">{contact.name}</span>
                  )}
                  <span className="text-[11px] text-muted-foreground truncate">{contact.email}</span>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function RecipientFields({ to, cc, bcc, onToChange, onCcChange, onBccChange }: Props) {
  const [showCc, setShowCc] = useState(cc.length > 0);
  const [showBcc, setShowBcc] = useState(bcc.length > 0);

  return (
    <div className="border-b border-border">
      {/* To line */}
      <div className="flex items-center justify-between border-b border-border">
        <div className="flex-1">
          {onToChange ? (
            <EmailChipsWithSearch
              label="À :"
              singleValue={to}
              onSingleChange={onToChange}
            />
          ) : (
            <div className="flex items-center gap-2 px-3 py-1.5 text-xs">
              <span className="text-muted-foreground font-medium">À :</span>
              <span className="text-foreground">{to}</span>
            </div>
          )}
        </div>
        <div className="flex gap-1 px-2">
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

      {showCc && <EmailChipsWithSearch label="Cc :" emails={cc} onChange={onCcChange} />}
      {showBcc && <EmailChipsWithSearch label="Cci :" emails={bcc} onChange={onBccChange} />}
    </div>
  );
}

import { useState, useRef, useEffect } from "react";
import {
  UserPlus, Tag, Clock, CheckCircle, MessageSquare, Send,
  MoreHorizontal, Sparkles, ChevronDown, ChevronUp, User,
  Building2, DollarSign, CalendarDays, ArrowUp, ArrowRight,
  ArrowDown, Loader2, Trash2, Pencil, Check, X, Contact,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { ContactPanel } from "@/components/inbox/ContactPanel";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { decodeHtml, categoryLabels, type ConversationDetailData } from "./types";
import { ResponseTimeBadge } from "../ResponseTimeBadge";
import { calcResponseTimes } from "@/lib/response-time";

const priorityIcons: Record<string, { icon: typeof ArrowUp; className: string; label: string }> = {
  high: { icon: ArrowUp, className: "text-destructive", label: "Haute" },
  medium: { icon: ArrowRight, className: "text-amber-500", label: "Moyenne" },
  low: { icon: ArrowDown, className: "text-muted-foreground", label: "Basse" },
};

type Props = {
  conversation: ConversationDetailData;
  onStatusChange?: (id: string, status: "open" | "snoozed" | "closed") => void;
  onDelete?: (id: string) => void;
  onReplyClick: () => void;
  onSelectConversation?: (id: string) => void;
};

export function ConversationHeader({ conversation, onStatusChange, onDelete, onReplyClick, onSelectConversation }: Props) {
  const [infoOpen, setInfoOpen] = useState(false);
  const [editingSubject, setEditingSubject] = useState(false);
  const [subjectDraft, setSubjectDraft] = useState("");
  const [savingSubject, setSavingSubject] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);
  const subjectInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingSubject && subjectInputRef.current) {
      subjectInputRef.current.focus();
      subjectInputRef.current.select();
    }
  }, [editingSubject]);

  const handleStartEditSubject = () => {
    setSubjectDraft(decodeHtml(conversation.subject));
    setEditingSubject(true);
  };

  const handleSaveSubject = async () => {
    if (!subjectDraft.trim()) return;
    setSavingSubject(true);
    try {
      const { error } = await supabase
        .from("conversations")
        .update({ subject: subjectDraft.trim() })
        .eq("id", conversation.id);
      if (error) throw error;
      conversation.subject = subjectDraft.trim();
      toast.success("Objet mis à jour");
      setEditingSubject(false);
    } catch (err: any) {
      toast.error("Erreur : " + (err.message || String(err)));
    } finally {
      setSavingSubject(false);
    }
  };

  const statusConfig = {
    open: { label: "Ouvert", icon: MessageSquare, className: "text-green-600" },
    snoozed: { label: "En pause", icon: Clock, className: "text-amber-500" },
    closed: { label: "Fermé", icon: CheckCircle, className: "text-muted-foreground" },
  };

  const status = statusConfig[conversation.status];
  const prio = conversation.priority ? priorityIcons[conversation.priority] : null;
  const entities = conversation.entities || {};
  const hasEntities =
    entities.people?.length || entities.companies?.length || entities.amounts?.length || entities.dates?.length;
  const hasAiInfo = conversation.ai_summary || conversation.category || hasEntities;

  // Calculate avg response time for this conversation
  const responseTimes = calcResponseTimes(conversation.messages || []);
  const avgResponseMin = responseTimes.length > 0
    ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
    : null;

  return (
    <div className="px-4 py-3 border-b border-border space-y-2">
      <div className="flex items-center justify-between gap-2">
        {editingSubject ? (
          <div className="flex items-center gap-1 flex-1 min-w-0">
            <input
              ref={subjectInputRef}
              value={subjectDraft}
              onChange={(e) => setSubjectDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSaveSubject();
                if (e.key === "Escape") setEditingSubject(false);
              }}
              className="flex-1 min-w-0 text-lg font-semibold bg-transparent border-b-2 border-primary outline-none text-foreground"
              disabled={savingSubject}
            />
            <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={handleSaveSubject} disabled={savingSubject || !subjectDraft.trim()}>
              {savingSubject ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5 text-green-600" />}
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => setEditingSubject(false)} disabled={savingSubject}>
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        ) : (
          <h2
            className="text-lg font-semibold text-foreground truncate cursor-pointer group flex items-center gap-1.5 hover:text-primary transition-colors"
            onClick={handleStartEditSubject}
            title="Cliquer pour modifier l'objet"
          >
            {decodeHtml(conversation.subject)}
            <Pencil className="h-3.5 w-3.5 opacity-0 group-hover:opacity-50 transition-opacity shrink-0" />
          </h2>
        )}
        <div className="flex items-center gap-2 shrink-0">
          <Button size="sm" className="h-9 px-4 font-semibold gap-1.5" onClick={onReplyClick}>
            <Send className="h-4 w-4" /> Répondre
          </Button>
          {conversation.from_email && (
            <Button variant="outline" size="sm" className="h-9 px-4 font-semibold gap-1.5" onClick={() => setContactOpen(true)}>
              <Contact className="h-4 w-4" /> Contact
            </Button>
          )}
          <Button variant="outline" size="sm" className="h-9 px-4 font-semibold gap-1.5" onClick={() => onDelete?.(conversation.id)}>
            <Trash2 className="h-4 w-4" /> Archiver
          </Button>
          <Button
            variant={conversation.status === "snoozed" ? "secondary" : "outline"}
            size="sm"
            className="h-9 px-4 font-semibold gap-1.5"
            onClick={() => onStatusChange?.(conversation.id, conversation.status === "snoozed" ? "open" : "snoozed")}
          >
            <Clock className="h-4 w-4" /> {conversation.status === "snoozed" ? "Reprendre" : "Todo"}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-9 w-9">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onStatusChange?.(conversation.id, "open")}>
                <MessageSquare className="h-4 w-4 mr-2 text-green-600" /> Ouvrir
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onStatusChange?.(conversation.id, "closed")}>
                <CheckCircle className="h-4 w-4 mr-2" /> Fermer
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <Badge variant="outline" className={cn("gap-1", status.className)}>
          <status.icon className="h-3 w-3" />
          {status.label}
        </Badge>
        {prio && (
          <Badge variant="outline" className={cn("gap-1", prio.className)}>
            <prio.icon className="h-3 w-3" />
            {prio.label}
          </Badge>
        )}
        {conversation.category && (
          <Badge variant="secondary" className="gap-1">
            {categoryLabels[conversation.category] || conversation.category}
          </Badge>
        )}
        {conversation.is_noise && (
          <Badge variant="secondary" className="gap-1 text-muted-foreground">
            🔇 Bruit
          </Badge>
        )}
        {conversation.assignee_name && (
          <Badge variant="secondary" className="gap-1">
            <UserPlus className="h-3 w-3" />
            {conversation.assignee_name}
          </Badge>
        )}
        {conversation.tags?.map((tag) => (
          <Badge key={tag.id} variant="outline" className="gap-1" style={{ borderColor: tag.color, color: tag.color }}>
            <Tag className="h-3 w-3" />
            {tag.name}
          </Badge>
        ))}
        {avgResponseMin !== null && (
          <ResponseTimeBadge minutes={avgResponseMin} variant="full" />
        )}
      </div>

      {hasAiInfo && (
        <Collapsible open={infoOpen} onOpenChange={setInfoOpen}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="w-full justify-between h-7 text-xs text-muted-foreground hover:text-foreground">
              <span className="flex items-center gap-1">
                <Sparkles className="h-3 w-3" /> Informations IA
              </span>
              {infoOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-2 space-y-2">
            {conversation.ai_summary && (
              <p className="text-xs text-muted-foreground bg-muted/50 rounded p-2">
                💡 {conversation.ai_summary}
              </p>
            )}
            {hasEntities && (
              <div className="flex flex-wrap gap-1.5">
                {entities.people?.map((p: string, i: number) => (
                  <Badge key={`p-${i}`} variant="outline" className="text-[10px] gap-1">
                    <User className="h-2.5 w-2.5" /> {p}
                  </Badge>
                ))}
                {entities.companies?.map((c: string, i: number) => (
                  <Badge key={`c-${i}`} variant="outline" className="text-[10px] gap-1 border-blue-300 text-blue-600">
                    <Building2 className="h-2.5 w-2.5" /> {c}
                  </Badge>
                ))}
                {entities.amounts?.map((a: string, i: number) => (
                  <Badge key={`a-${i}`} variant="outline" className="text-[10px] gap-1 border-green-300 text-green-600">
                    <DollarSign className="h-2.5 w-2.5" /> {a}
                  </Badge>
                ))}
                {entities.dates?.map((d: string, i: number) => (
                  <Badge key={`d-${i}`} variant="outline" className="text-[10px] gap-1 border-amber-300 text-amber-600">
                    <CalendarDays className="h-2.5 w-2.5" /> {d}
                  </Badge>
                ))}
              </div>
            )}
          </CollapsibleContent>
        </Collapsible>
      )}

      <Sheet open={contactOpen} onOpenChange={setContactOpen}>
        <SheetContent side="right" className="p-0 w-[320px] sm:max-w-[320px]">
          <SheetTitle className="sr-only">Fiche contact</SheetTitle>
          <ContactPanel
            contactEmail={conversation.from_email || null}
            onSelectConversation={(id) => {
              setContactOpen(false);
              onSelectConversation?.(id);
            }}
          />
        </SheetContent>
      </Sheet>
    </div>
  );
}

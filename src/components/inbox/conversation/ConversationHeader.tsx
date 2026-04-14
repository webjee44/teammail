import { useState, useRef, useEffect } from "react";
import {
  UserPlus, Tag, Clock, CheckCircle, MessageSquare, Send,
  MoreHorizontal, Sparkles, ChevronDown, ChevronUp, User,
  Building2, DollarSign, CalendarDays, ArrowUp, ArrowRight,
  ArrowDown, Loader2, Trash2, Pencil, Check, X, Contact, UserMinus,
  Archive, Forward,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Tooltip, TooltipContent, TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { ContactPanel } from "@/components/inbox/ContactPanel";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { decodeHtml, categoryLabels, type ConversationDetailData } from "./types";
import { ResponseTimeBadge } from "../ResponseTimeBadge";
import { calcResponseTimes } from "@/lib/response-time";
import { useAuth } from "@/hooks/useAuth";

const priorityIcons: Record<string, { icon: typeof ArrowUp; className: string; label: string }> = {
  high: { icon: ArrowUp, className: "text-destructive", label: "Haute" },
  medium: { icon: ArrowRight, className: "text-amber-500", label: "Moyenne" },
  low: { icon: ArrowDown, className: "text-muted-foreground", label: "Basse" },
};

type TeamMember = {
  user_id: string;
  full_name: string | null;
  email: string | null;
  avatar_url: string | null;
};

type Props = {
  conversation: ConversationDetailData;
  onStatusChange?: (id: string, status: "open" | "closed") => void;
  onDelete?: (id: string) => void;
  onReplyClick: () => void;
  onSelectConversation?: (id: string) => void;
  onAssign?: (conversationId: string, userId: string | null) => void;
  onForward?: () => void;
  onReplyAll?: () => void;
};

export function ConversationHeader({ conversation, onStatusChange, onDelete, onReplyClick, onSelectConversation, onAssign, onForward, onReplyAll }: Props) {
  const { user } = useAuth();
  const [infoOpen, setInfoOpen] = useState(false);
  const [editingSubject, setEditingSubject] = useState(false);
  const [subjectDraft, setSubjectDraft] = useState("");
  const [savingSubject, setSavingSubject] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [assigning, setAssigning] = useState(false);
  const subjectInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingSubject && subjectInputRef.current) {
      subjectInputRef.current.focus();
      subjectInputRef.current.select();
    }
  }, [editingSubject]);

  useEffect(() => {
    const loadTeamMembers = async () => {
      const { data } = await supabase
        .from("profiles")
        .select("user_id, full_name, email, avatar_url");
      if (data) setTeamMembers(data);
    };
    loadTeamMembers();
  }, []);

  const handleAssign = async (userId: string | null) => {
    setAssigning(true);
    try {
      const { error } = await supabase
        .from("conversations")
        .update({ assigned_to: userId })
        .eq("id", conversation.id);
      if (error) throw error;
      conversation.assigned_to = userId;
      const member = teamMembers.find(m => m.user_id === userId);
      (conversation as any).assignee_name = member?.full_name || member?.email || null;
      onAssign?.(conversation.id, userId);
      toast.success(userId ? `Assigné à ${member?.full_name || member?.email}` : "Assignation retirée");
    } catch (err: any) {
      toast.error("Erreur : " + (err.message || String(err)));
    } finally {
      setAssigning(false);
    }
  };

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

  const statusConfig: Record<string, { label: string; icon: typeof MessageSquare; className: string }> = {
    open: { label: "Ouvert", icon: MessageSquare, className: "text-green-600" },
    closed: { label: "Fermé", icon: CheckCircle, className: "text-muted-foreground" },
  };

  const status = statusConfig[conversation.status] || statusConfig.open;
  const prio = conversation.priority ? priorityIcons[conversation.priority] : null;
  const entities = conversation.entities || {};
  const hasEntities =
    entities.people?.length || entities.companies?.length || entities.amounts?.length || entities.dates?.length;
  const hasAiInfo = conversation.ai_summary || conversation.category || hasEntities;

  const firstOutbound = (conversation.messages || []).find((m) => m.is_outbound && m.to_email);
  const recipientEmail = firstOutbound?.to_email || null;
  const contactEmail = recipientEmail && conversation.from_email === firstOutbound?.from_email
    ? recipientEmail
    : conversation.from_email;

  const responseTimes = calcResponseTimes(conversation.messages || []);
  const avgResponseMin = responseTimes.length > 0
    ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
    : null;

  const assigneeName = (conversation as any).assignee_name;

  return (
    <div className="px-4 py-3 border-b border-border space-y-1.5">
      {/* Row 1: Subject + icon actions */}
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
              className="flex-1 min-w-0 text-base font-semibold bg-transparent border-b-2 border-primary outline-none text-foreground"
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
            className="font-semibold text-foreground truncate cursor-pointer group flex items-center gap-1.5 hover:text-primary transition-colors text-lg"
            onClick={handleStartEditSubject}
            title="Cliquer pour modifier l'objet"
          >
            {conversation.seq_number && (
              <span className="text-xs font-mono text-muted-foreground font-normal">#{conversation.seq_number}</span>
            )}
            {decodeHtml(conversation.subject)}
            <Pencil className="h-3 w-3 opacity-0 group-hover:opacity-50 transition-opacity shrink-0" />
          </h2>
        )}

        {/* Compact icon actions */}
        <div className="flex items-center gap-1 shrink-0 mr-8">
          {/* Reply All button */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onReplyAll}>
                <Send className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Répondre à tous</TooltipContent>
          </Tooltip>
          {/* Forward button */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onForward}>
                <Forward className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Transférer</TooltipContent>
          </Tooltip>
          {/* Quick "Traité" button */}
          {conversation.status === "open" && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1.5 text-xs font-medium border-green-200 text-green-700 hover:bg-green-50 hover:text-green-800 dark:border-green-800 dark:text-green-400 dark:hover:bg-green-950"
                  onClick={() => onStatusChange?.(conversation.id, "closed")}
                >
                  <CheckCircle className="h-3.5 w-3.5" />
                  Traité
                </Button>
              </TooltipTrigger>
              <TooltipContent>Marquer comme traité et retirer du backlog</TooltipContent>
            </Tooltip>
          )}
          {contactEmail && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setContactOpen(true)}>
                  <Contact className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Contact</TooltipContent>
            </Tooltip>
          )}

          {/* Assignment */}
          <DropdownMenu>
            <Tooltip>
              <TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className={cn("h-8 w-8", assigneeName && "text-primary")} disabled={assigning}>
                    {assigning ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
                  </Button>
                </DropdownMenuTrigger>
              </TooltipTrigger>
              <TooltipContent>{assigneeName || "Assigner"}</TooltipContent>
            </Tooltip>
            <DropdownMenuContent align="end" className="w-56">
              {user && (
                <DropdownMenuItem onClick={() => handleAssign(user.id)}>
                  <User className="h-4 w-4 mr-2 text-primary" /> M'assigner
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              {teamMembers.map((member) => (
                <DropdownMenuItem
                  key={member.user_id}
                  onClick={() => handleAssign(member.user_id)}
                  className={cn(conversation.assigned_to === member.user_id && "bg-accent")}
                >
                  <User className="h-4 w-4 mr-2" />
                  {member.full_name || member.email || "Sans nom"}
                  {conversation.assigned_to === member.user_id && (
                    <Check className="h-3.5 w-3.5 ml-auto text-primary" />
                  )}
                </DropdownMenuItem>
              ))}
              {conversation.assigned_to && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => handleAssign(null)} className="text-destructive">
                    <UserMinus className="h-4 w-4 mr-2" /> Retirer l'assignation
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Overflow: Archive, Status */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onStatusChange?.(conversation.id, "open")}>
                <MessageSquare className="h-4 w-4 mr-2 text-green-600" /> Marquer ouvert
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onStatusChange?.(conversation.id, "closed")}>
                <CheckCircle className="h-4 w-4 mr-2" /> Marquer fermé
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => onDelete?.(conversation.id)} className="text-destructive">
                <Archive className="h-4 w-4 mr-2" /> Archiver
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Row 2: Metadata badges — compact */}
      <div className="flex items-center gap-1.5 flex-wrap text-xs">
        <Badge variant="outline" className={cn("gap-1 text-[11px] h-5 px-1.5", status.className)}>
          <status.icon className="h-2.5 w-2.5" />
          {status.label}
        </Badge>
        {prio && (
          <Badge variant="outline" className={cn("gap-1 text-[11px] h-5 px-1.5", prio.className)}>
            <prio.icon className="h-2.5 w-2.5" />
            {prio.label}
          </Badge>
        )}
        {conversation.category && (
          <Badge variant="secondary" className="text-[11px] h-5 px-1.5">
            {categoryLabels[conversation.category] || conversation.category}
          </Badge>
        )}
        {conversation.is_noise && (
          <Badge variant="secondary" className="text-[11px] h-5 px-1.5 text-muted-foreground">
            🔇 Bruit
          </Badge>
        )}
        {assigneeName && (
          <Badge variant="secondary" className="gap-1 text-[11px] h-5 px-1.5">
            <UserPlus className="h-2.5 w-2.5" />
            {assigneeName}
          </Badge>
        )}
        {conversation.tags?.map((tag) => (
          <Badge key={tag.id} variant="outline" className="gap-1 text-[11px] h-5 px-1.5" style={{ borderColor: tag.color, color: tag.color }}>
            <Tag className="h-2.5 w-2.5" />
            {tag.name}
          </Badge>
        ))}
        {avgResponseMin !== null && (
          <ResponseTimeBadge minutes={avgResponseMin} variant="full" />
        )}
      </div>

      {/* AI Info — collapsible */}
      {hasAiInfo && (
        <Collapsible open={infoOpen} onOpenChange={setInfoOpen}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="w-full justify-between h-6 text-[11px] text-muted-foreground hover:text-foreground px-1">
              <span className="flex items-center gap-1">
                <Sparkles className="h-3 w-3" /> Informations IA
              </span>
              {infoOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-1.5 space-y-1.5">
            {conversation.ai_summary && (
              <p className="text-xs text-muted-foreground bg-muted/50 rounded p-2">
                💡 {conversation.ai_summary}
              </p>
            )}
            {hasEntities && (
              <div className="flex flex-wrap gap-1">
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
            contactEmail={contactEmail || null}
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

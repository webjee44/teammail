import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import {
  Send, MessageSquare, Sparkles, Clock, Loader2, FileText, CalendarIcon, Wand2, Mail,
  ChevronDown, Save, Forward, Reply,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Tooltip, TooltipContent, TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { AttachmentUpload, FileToUpload } from "../Attachments";
import { TemplatePickerDialog } from "../TemplatePickerDialog";
import { MentionTextarea } from "../MentionTextarea";
import { RichTextEditor } from "./RichTextEditor";
import { RecipientFields } from "./RecipientFields";
import { useDraft } from "@/hooks/useDraft";
import type { Suggestion, ConversationDetailData } from "./types";

type Props = {
  conversation: ConversationDetailData;
  activeTab: string;
  onActiveTabChange: (tab: string) => void;
  onReply?: (id: string, body: string, attachments?: FileToUpload[]) => void;
  onComment?: (id: string, body: string) => void;
  onForward?: () => void;
  onReplyAll?: () => void;
};

export function ReplyArea({ conversation, activeTab, onActiveTabChange, onReply, onComment, onForward, onReplyAll }: Props) {
  const navigate = useNavigate();
  const { draft, updateDraft, deleteDraft, loading: draftLoading } = useDraft({ conversationId: conversation.id });
  const [replyHtml, setReplyHtml] = useState("");
  const [commentText, setCommentText] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState<FileToUpload[]>([]);
  const [templateOpen, setTemplateOpen] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [scheduleDate, setScheduleDate] = useState<Date | undefined>();
  const [scheduleTime, setScheduleTime] = useState("09:00");
  const [scheduling, setScheduling] = useState(false);
  const [polishing, setPolishing] = useState(false);
  const [signatureHtml, setSignatureHtml] = useState("");
  const [draftInitialized, setDraftInitialized] = useState(false);
  const [cc, setCc] = useState<string[]>([]);
  const [bcc, setBcc] = useState<string[]>([]);

  useEffect(() => {
    if (draftLoading || draftInitialized) return;
    if (draft.body) setReplyHtml(draft.body);
    setDraftInitialized(true);
  }, [draftLoading, draft, draftInitialized]);

  useEffect(() => {
    if (!draftInitialized) return;
    updateDraft({ body: replyHtml });
  }, [replyHtml, draftInitialized, updateDraft]);

  useEffect(() => {
    const loadSignature = async () => {
      const { data: defaultSig } = await supabase
        .from("signatures")
        .select("body_html")
        .eq("is_default", true)
        .maybeSingle();
      setSignatureHtml(defaultSig?.body_html || "");
    };
    loadSignature();
  }, []);

  const recipientEmail = conversation.messages.find((m) => !m.is_outbound)?.from_email || conversation.from_email || "";
  const senderEmail = [...conversation.messages].reverse().find((m) => m.is_outbound)?.from_email || conversation.from_email || "";
  const replySubject = conversation.subject?.startsWith("Re:") ? conversation.subject : `Re: ${conversation.subject}`;

  const isReplyEmpty = !replyHtml.trim() || replyHtml === "<p></p>";

  const resetState = async () => {
    await deleteDraft();
    setReplyHtml("");
    setDraftInitialized(false);
    setSuggestions([]);
    setAttachedFiles([]);
    setCc([]);
    setBcc([]);
  };

  const handleSuggestReplies = async () => {
    setLoadingSuggestions(true);
    setSuggestions([]);
    try {
      const { data, error } = await supabase.functions.invoke("ai-suggest-reply", {
        body: { conversation_id: conversation.id },
      });
      if (error) throw error;
      if (data?.error) { toast.error(data.error); return; }
      setSuggestions(data.suggestions || []);
    } catch (err: any) {
      toast.error("Erreur lors de la génération des suggestions");
      console.error(err);
    } finally {
      setLoadingSuggestions(false);
    }
  };

  const handlePolish = async () => {
    if (isReplyEmpty) return;
    setPolishing(true);
    try {
      const { data, error } = await supabase.functions.invoke("polish-reply", {
        body: { text: replyHtml, format: "html" },
      });
      if (error) throw error;
      if (data?.error) { toast.error(data.error); return; }
      if (data?.polished) {
        setReplyHtml(data.polished);
        toast.success("Texte peaufiné");
      }
    } catch (err: any) {
      toast.error("Erreur lors du peaufinage");
      console.error(err);
    } finally {
      setPolishing(false);
    }
  };

  const handleSaveAsTemplate = async () => {
    const name = window.prompt("Nom du template :", replySubject || "");
    if (!name) return;
    try {
      const { data: { user: u } } = await supabase.auth.getUser();
      if (!u) throw new Error("Non authentifié");
      const { data: profile } = await supabase.from("profiles").select("team_id").eq("user_id", u.id).maybeSingle();
      if (!profile?.team_id) throw new Error("Aucune équipe");
      const { error } = await supabase.from("email_templates").insert({
        team_id: profile.team_id,
        created_by: u.id,
        name,
        subject: replySubject,
        body: replyHtml,
      });
      if (error) throw error;
      toast.success("Template créé !");
    } catch (err: any) {
      toast.error("Erreur : " + (err.message || String(err)));
    }
  };

  const handleScheduleReply = async () => {
    if (isReplyEmpty) { toast.error("Rédigez votre réponse avant de programmer l'envoi"); return; }
    if (!scheduleDate) { toast.error("Sélectionnez une date d'envoi"); return; }
    if (!senderEmail || !recipientEmail) { toast.error("Adresse expéditeur ou destinataire manquante"); return; }
    const [hours, minutes] = scheduleTime.split(":").map(Number);
    const scheduledAt = new Date(scheduleDate);
    scheduledAt.setHours(hours, minutes, 0, 0);
    if (scheduledAt <= new Date()) { toast.error("La date doit être dans le futur"); return; }
    setScheduling(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Non authentifié");
      const { data: profile } = await supabase
        .from("profiles").select("team_id").eq("user_id", user.id).maybeSingle();
      if (!profile?.team_id) throw new Error("Aucune équipe trouvée");
      const { error } = await supabase.from("scheduled_emails").insert({
        team_id: profile.team_id, created_by: user.id,
        to_email: recipientEmail, subject: replySubject,
        body: replyHtml, from_email: senderEmail,
        scheduled_at: scheduledAt.toISOString(),
      });
      if (error) throw error;
      await resetState();
      toast.success(`Réponse programmée pour le ${format(scheduledAt, "d MMMM à HH:mm", { locale: fr })}`);
    } catch (err: any) {
      toast.error("Erreur : " + (err.message || String(err)));
    } finally {
      setScheduling(false);
      setScheduleOpen(false);
    }
  };

  const handleQuickSchedule = async () => {
    if (isReplyEmpty) { toast.error("Rédigez votre réponse"); return; }
    if (!senderEmail || !recipientEmail) { toast.error("Adresse manquante"); return; }
    const next = new Date();
    next.setDate(next.getDate() + 1);
    const day = next.getDay();
    if (day === 0) next.setDate(next.getDate() + 1);
    if (day === 6) next.setDate(next.getDate() + 2);
    next.setHours(8, 45, 0, 0);
    const dayName = format(next, "EEEE", { locale: fr });
    setScheduling(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Non authentifié");
      const { data: profile } = await supabase
        .from("profiles").select("team_id").eq("user_id", user.id).maybeSingle();
      if (!profile?.team_id) throw new Error("Aucune équipe trouvée");
      const { error } = await supabase.from("scheduled_emails").insert({
        team_id: profile.team_id, created_by: user.id,
        to_email: recipientEmail, subject: replySubject,
        body: replyHtml, from_email: senderEmail,
        scheduled_at: next.toISOString(),
      });
      if (error) throw error;
      await resetState();
      toast.success(`Réponse programmée pour ${dayName} à 8h45`);
    } catch (err: any) {
      toast.error("Erreur : " + (err.message || String(err)));
    } finally {
      setScheduling(false);
      setScheduleOpen(false);
    }
  };

  return (
    <div className="border-t border-border p-3" data-reply-area>
      <Tabs value={activeTab} onValueChange={onActiveTabChange}>
        <TabsList className="h-8 mb-2">
          <TabsTrigger value="reply" className="text-xs h-7 px-3">
            <Send className="h-3 w-3 mr-1" /> Répondre
          </TabsTrigger>
          <TabsTrigger value="comment" className="text-xs h-7 px-3">
            <MessageSquare className="h-3 w-3 mr-1" /> Note interne
          </TabsTrigger>
          <button
            type="button"
            onClick={onReplyAll}
            className="inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 h-7 text-xs font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 text-muted-foreground hover:text-foreground hover:bg-muted"
          >
            <Reply className="h-3 w-3 mr-1" /> Répondre à tous
          </button>
          <button
            type="button"
            onClick={onForward}
            className="inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 h-7 text-xs font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 text-muted-foreground hover:text-foreground hover:bg-muted"
          >
            <Forward className="h-3 w-3 mr-1" /> Transférer
          </button>
        </TabsList>
        <TabsContent value="reply" className="mt-0">
          <div className="space-y-2">
            <RecipientFields to={recipientEmail} cc={cc} bcc={bcc} onCcChange={setCc} onBccChange={setBcc} />

            {suggestions.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {suggestions.map((s, i) =>
                  s.action === "compose_to" && s.action_email ? (
                    <button
                      key={i}
                      onClick={() => {
                        const subject = conversation.subject?.replace(/^(Fwd?|Tr)\s*:\s*/i, "") || "";
                        navigate(`/compose?to=${encodeURIComponent(s.action_email!)}&subject=${encodeURIComponent(subject)}`);
                      }}
                      className="text-xs px-2.5 py-1 rounded-full border border-accent/30 bg-accent/5 text-accent-foreground hover:bg-accent/10 transition-colors"
                    >
                      <Mail className="h-3 w-3 inline mr-1" />
                      Écrire à {s.action_email}
                    </button>
                  ) : (
                    <button
                      key={i}
                      onClick={() => {
                        const html = s.body.split(/\n\n+/).map((p) => `<p>${p.replace(/\n/g, "<br>")}</p>`).join("");
                        setReplyHtml(html);
                        setSuggestions([]);
                      }}
                      className="text-xs px-2.5 py-1 rounded-full border border-primary/30 bg-primary/5 text-primary hover:bg-primary/10 transition-colors"
                    >
                      <Sparkles className="h-3 w-3 inline mr-1" />
                      {s.label}
                    </button>
                  )
                )}
              </div>
            )}

            <RichTextEditor
              value={replyHtml}
              onChange={setReplyHtml}
              placeholder="Tapez votre réponse…"
              onTemplateClick={() => setTemplateOpen(true)}
            />

            {signatureHtml && (
              <div className="p-2 rounded-md border border-border bg-muted/30 text-xs" dangerouslySetInnerHTML={{ __html: signatureHtml }} />
            )}

            <AttachmentUpload files={attachedFiles} onFilesChange={setAttachedFiles} />

            {/* Action bar — clean single row */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button size="sm" variant="ghost" onClick={handleSuggestReplies} disabled={loadingSuggestions} className="h-8 w-8 p-0">
                      {loadingSuggestions ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Suggérer une réponse</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button size="sm" variant="ghost" onClick={handlePolish} disabled={polishing || isReplyEmpty} className="h-8 w-8 p-0">
                      {polishing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Peaufiner</TooltipContent>
                </Tooltip>

                {/* Template dropdown: insert or save */}
                <DropdownMenu>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <DropdownMenuTrigger asChild>
                        <Button size="sm" variant="ghost" className="h-8 w-8 p-0">
                          <FileText className="h-3.5 w-3.5" />
                        </Button>
                      </DropdownMenuTrigger>
                    </TooltipTrigger>
                    <TooltipContent>Templates</TooltipContent>
                  </Tooltip>
                  <DropdownMenuContent align="start">
                    <DropdownMenuItem onClick={() => setTemplateOpen(true)}>
                      <FileText className="h-4 w-4 mr-2" /> Insérer un template
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleSaveAsTemplate} disabled={isReplyEmpty}>
                      <Save className="h-4 w-4 mr-2" /> Sauver comme template
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                <TemplatePickerDialog
                  open={templateOpen}
                  onOpenChange={setTemplateOpen}
                  onInsert={(_subject, body) => setReplyHtml(body)}
                  recipientEmail={recipientEmail}
                />
              </div>

              <div className="flex items-center gap-1.5">
                {/* Schedule send */}
                <Popover open={scheduleOpen} onOpenChange={setScheduleOpen}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <PopoverTrigger asChild>
                        <Button size="sm" variant="outline" disabled={isReplyEmpty || scheduling} className="h-8 w-8 p-0">
                          {scheduling ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Clock className="h-3.5 w-3.5" />}
                        </Button>
                      </PopoverTrigger>
                    </TooltipTrigger>
                    <TooltipContent>Programmer l'envoi</TooltipContent>
                  </Tooltip>
                  <PopoverContent className="w-auto p-4" align="end">
                    <div className="space-y-3">
                      <Button
                        size="sm" variant="secondary" className="w-full gap-1 capitalize"
                        disabled={isReplyEmpty || scheduling}
                        onClick={handleQuickSchedule}
                      >
                        {scheduling ? <Loader2 className="h-3 w-3 animate-spin" /> : <Clock className="h-3 w-3" />}
                        {(() => { const n = new Date(); n.setDate(n.getDate()+1); const d = n.getDay(); if(d===0) n.setDate(n.getDate()+1); if(d===6) n.setDate(n.getDate()+2); return format(n, "EEEE", { locale: fr }); })()} 8h45
                      </Button>
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">Date</Label>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !scheduleDate && "text-muted-foreground")}>
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              {scheduleDate ? format(scheduleDate, "d MMMM yyyy", { locale: fr }) : "Choisir une date"}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single" selected={scheduleDate} onSelect={setScheduleDate}
                              disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                              initialFocus className={cn("p-3 pointer-events-auto")}
                            />
                          </PopoverContent>
                        </Popover>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">Heure</Label>
                        <Input type="time" value={scheduleTime} onChange={(e) => setScheduleTime(e.target.value)} />
                      </div>
                      <Button onClick={handleScheduleReply} disabled={!scheduleDate || scheduling} className="w-full gap-2" size="sm">
                        {scheduling ? <Loader2 className="h-3 w-3 animate-spin" /> : <Clock className="h-3 w-3" />}
                        Programmer l'envoi
                      </Button>
                    </div>
                  </PopoverContent>
                </Popover>

                {/* Send */}
                <Button
                  size="sm"
                  onClick={async () => {
                    onReply?.(conversation.id, replyHtml, attachedFiles);
                    await resetState();
                  }}
                  disabled={isReplyEmpty}
                  className="gap-1.5 px-4"
                >
                  <Send className="h-3.5 w-3.5" /> Envoyer
                </Button>
              </div>
            </div>
          </div>
        </TabsContent>
        <TabsContent value="comment" className="mt-0">
          <div className="space-y-2">
            <MentionTextarea
              placeholder="Ajouter une note interne... (@mention pour taguer)"
              value={commentText}
              onChange={setCommentText}
              className="text-sm bg-warning/5 border-warning/20"
            />
            <div className="flex justify-end">
              <Button
                size="sm" variant="outline"
                onClick={() => { onComment?.(conversation.id, commentText); setCommentText(""); }}
                disabled={!commentText.trim()}
              >
                <MessageSquare className="h-3 w-3 mr-1" /> Ajouter note
              </Button>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

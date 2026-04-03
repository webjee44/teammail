import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import {
  Send, MessageSquare, Sparkles, Clock, Loader2, FileText, CalendarIcon, Wand2, Mail,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
};

export function ReplyArea({ conversation, activeTab, onActiveTabChange, onReply, onComment }: Props) {
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

  // Restore draft on load
  useEffect(() => {
    if (draftLoading || draftInitialized) return;
    if (draft.body) setReplyHtml(draft.body);
    setDraftInitialized(true);
  }, [draftLoading, draft, draftInitialized]);

  // Auto-save reply as draft
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
  const senderEmail = [...conversation.messages].reverse().find((m) => m.is_outbound)?.from_email || "";
  const replySubject = conversation.subject?.startsWith("Re:") ? conversation.subject : `Re: ${conversation.subject}`;

  const isReplyEmpty = !replyHtml.trim() || replyHtml === "<p></p>";

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

  const handleScheduleReply = async () => {
    if (isReplyEmpty || !scheduleDate || !senderEmail || !recipientEmail) {
      toast.error("Remplissez la réponse et sélectionnez une date");
      return;
    }
    const [hours, minutes] = scheduleTime.split(":").map(Number);
    const scheduledAt = new Date(scheduleDate);
    scheduledAt.setHours(hours, minutes, 0, 0);
    if (scheduledAt <= new Date()) {
      toast.error("La date doit être dans le futur");
      return;
    }
    setScheduling(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Non authentifié");
      const { data: profile } = await supabase
        .from("profiles")
        .select("team_id")
        .eq("user_id", user.id)
        .maybeSingle();
      if (!profile?.team_id) throw new Error("Aucune équipe trouvée");

      const { error } = await supabase.from("scheduled_emails").insert({
        team_id: profile.team_id,
        created_by: user.id,
        to_email: recipientEmail,
        subject: replySubject,
        body: replyHtml,
        from_email: senderEmail,
        scheduled_at: scheduledAt.toISOString(),
      });
      if (error) throw error;
      await deleteDraft();
      toast.success(`Réponse programmée pour le ${format(scheduledAt, "d MMMM à HH:mm", { locale: fr })}`);
      setReplyHtml("");
      setDraftInitialized(false);
      setSuggestions([]);
      setAttachedFiles([]);
      setCc([]);
      setBcc([]);
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
        </TabsList>
        <TabsContent value="reply" className="mt-0">
          <div className="space-y-2">
            {/* Recipient fields */}
            <RecipientFields
              to={recipientEmail}
              cc={cc}
              bcc={bcc}
              onCcChange={setCc}
              onBccChange={setBcc}
            />

            {/* AI Suggestions */}
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
                      className="text-xs px-2.5 py-1.5 rounded-full border border-accent/30 bg-accent/5 text-accent-foreground hover:bg-accent/10 transition-colors"
                    >
                      <Mail className="h-3 w-3 inline mr-1" />
                      Écrire à {s.action_email}
                    </button>
                  ) : (
                    <button
                      key={i}
                      onClick={() => {
                        const html = s.body
                          .split(/\n\n+/)
                          .map((p) => `<p>${p.replace(/\n/g, "<br>")}</p>`)
                          .join("");
                        setReplyHtml(html);
                        setSuggestions([]);
                      }}
                      className="text-xs px-2.5 py-1.5 rounded-full border border-primary/30 bg-primary/5 text-primary hover:bg-primary/10 transition-colors"
                    >
                      <Sparkles className="h-3 w-3 inline mr-1" />
                      {s.label}
                    </button>
                  )
                )}
              </div>
            )}

            {/* Rich Text Editor */}
            <RichTextEditor
              value={replyHtml}
              onChange={setReplyHtml}
              placeholder="Tapez votre réponse…"
            />

            {/* Signature */}
            {signatureHtml && (
              <div
                className="p-2 rounded-md border border-border bg-muted/30 text-xs"
                dangerouslySetInnerHTML={{ __html: signatureHtml }}
              />
            )}

            {/* Attachments */}
            <AttachmentUpload files={attachedFiles} onFilesChange={setAttachedFiles} />

            {/* Actions */}
            <div className="flex justify-between items-center flex-wrap gap-2">
              <div className="flex gap-1.5">
                <Button size="sm" variant="outline" onClick={handleSuggestReplies} disabled={loadingSuggestions} className="gap-1">
                  {loadingSuggestions ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                  Suggérer
                </Button>
                <Button size="sm" variant="outline" onClick={handlePolish} disabled={polishing || isReplyEmpty} className="gap-1">
                  {polishing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Wand2 className="h-3 w-3" />}
                  Peaufiner
                </Button>
                <Button size="sm" variant="outline" onClick={() => setTemplateOpen(true)} className="gap-1">
                  <FileText className="h-3 w-3" />
                  Template
                </Button>
                <TemplatePickerDialog
                  open={templateOpen}
                  onOpenChange={setTemplateOpen}
                  onInsert={(_subject, body) => setReplyHtml(`<p>${body.replace(/\n/g, "</p><p>")}</p>`)}
                  recipientEmail={recipientEmail}
                />
              </div>
              <div className="flex gap-1.5">
                <Popover open={scheduleOpen} onOpenChange={setScheduleOpen}>
                  <PopoverTrigger asChild>
                    <Button size="sm" variant="outline" disabled={isReplyEmpty || scheduling} className="gap-1">
                      {scheduling ? <Loader2 className="h-3 w-3 animate-spin" /> : <Clock className="h-3 w-3" />}
                      Plus tard
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-4" align="end">
                    <div className="space-y-4">
                      {(() => {
                        const now = new Date();
                        const next = new Date(now);
                        next.setDate(next.getDate() + 1);
                        const day = next.getDay();
                        if (day === 0) next.setDate(next.getDate() + 1);
                        if (day === 6) next.setDate(next.getDate() + 2);
                        const dayName = format(next, "EEEE", { locale: fr });
                        return (
                          <Button
                            size="sm"
                            variant="secondary"
                            className="w-full gap-1 capitalize"
                            disabled={isReplyEmpty || scheduling}
                            onClick={async () => {
                              next.setHours(8, 45, 0, 0);
                              setScheduleDate(next);
                              setScheduleTime("08:45");
                              // Programme directement
                              if (isReplyEmpty || !senderEmail || !recipientEmail) {
                                toast.error("Remplissez la réponse avant de programmer");
                                return;
                              }
                              setScheduling(true);
                              try {
                                const { data: { user } } = await supabase.auth.getUser();
                                if (!user) throw new Error("Non authentifié");
                                const { data: profile } = await supabase
                                  .from("profiles")
                                  .select("team_id")
                                  .eq("user_id", user.id)
                                  .maybeSingle();
                                if (!profile?.team_id) throw new Error("Aucune équipe trouvée");
                                const { error } = await supabase.from("scheduled_emails").insert({
                                  team_id: profile.team_id,
                                  created_by: user.id,
                                  to_email: recipientEmail,
                                  subject: replySubject,
                                  body: replyHtml,
                                  from_email: senderEmail,
                                  scheduled_at: next.toISOString(),
                                });
                                if (error) throw error;
                                toast.success(`Réponse programmée pour ${dayName} à 8h45`);
                                setReplyHtml("");
                                setSuggestions([]);
                                setAttachedFiles([]);
                                setCc([]);
                                setBcc([]);
                              } catch (err: any) {
                                toast.error("Erreur : " + (err.message || String(err)));
                              } finally {
                                setScheduling(false);
                                setScheduleOpen(false);
                              }
                            }}
                          >
                            {scheduling ? <Loader2 className="h-3 w-3 animate-spin" /> : <Clock className="h-3 w-3" />}
                            {dayName} 8h45
                          </Button>
                        );
                      })()}
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">Date</Label>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              className={cn("w-full justify-start text-left font-normal", !scheduleDate && "text-muted-foreground")}
                            >
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              {scheduleDate ? format(scheduleDate, "d MMMM yyyy", { locale: fr }) : "Choisir une date"}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={scheduleDate}
                              onSelect={setScheduleDate}
                              disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                              initialFocus
                              className={cn("p-3 pointer-events-auto")}
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
                <Button
                  size="sm"
                  onClick={async () => {
                    onReply?.(conversation.id, replyHtml, attachedFiles);
                    await deleteDraft();
                    setReplyHtml("");
                    setSuggestions([]);
                    setAttachedFiles([]);
                    setCc([]);
                    setBcc([]);
                  }}
                  disabled={isReplyEmpty}
                >
                  <Send className="h-3 w-3 mr-1" /> Envoyer
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
                size="sm"
                variant="outline"
                onClick={() => {
                  onComment?.(conversation.id, commentText);
                  setCommentText("");
                }}
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

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (conversationId: string) => void;
}

export function NewWhatsAppDialog({ open, onOpenChange, onCreated }: Props) {
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    if (!phone.trim() || !message.trim()) return;
    setSending(true);

    try {
      const res = await supabase.functions.invoke("wasender-send", {
        body: { to: phone.trim(), text: message.trim() },
      });

      if (res.error) throw new Error(res.error.message);

      const convId = res.data?.conversation_id;
      toast.success("Message envoyé !");
      setPhone("");
      setMessage("");
      if (convId) onCreated(convId);
    } catch (err: any) {
      toast.error("Erreur: " + (err.message || "Impossible d'envoyer"));
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            💬 Nouvelle conversation WhatsApp
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <Label className="text-[13px]">Numéro de téléphone (format E.164)</Label>
            <Input
              placeholder="+33612345678"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="mt-1"
            />
          </div>
          <div>
            <Label className="text-[13px]">Message</Label>
            <Textarea
              placeholder="Votre message..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="mt-1 min-h-[80px]"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button
            onClick={handleSend}
            disabled={!phone.trim() || !message.trim() || sending}
            className="bg-green-500 hover:bg-green-600"
          >
            {sending ? "Envoi..." : "Envoyer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

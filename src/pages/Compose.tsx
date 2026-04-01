import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Send, X } from "lucide-react";
import { toast } from "sonner";

const Compose = () => {
  const navigate = useNavigate();
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");

  const handleSend = () => {
    toast.success("Email envoyé !");
    navigate("/");
  };

  return (
    <AppLayout>
      <div className="flex-1 p-6 max-w-3xl mx-auto">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Nouveau message</CardTitle>
              <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="to">À</Label>
              <Input
                id="to"
                placeholder="destinataire@example.com"
                value={to}
                onChange={(e) => setTo(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="subject">Objet</Label>
              <Input
                id="subject"
                placeholder="Objet du message"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="body">Message</Label>
              <Textarea
                id="body"
                placeholder="Tapez votre message..."
                value={body}
                onChange={(e) => setBody(e.target.value)}
                className="min-h-[250px] resize-none"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => navigate("/")}>
                Annuler
              </Button>
              <Button onClick={handleSend} disabled={!to || !subject || !body} className="gap-2">
                <Send className="h-4 w-4" /> Envoyer
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
};

export default Compose;

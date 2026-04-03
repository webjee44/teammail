import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useComposeWindow } from "@/hooks/useComposeWindow";
import { AppLayout } from "@/components/layout/AppLayout";

const Compose = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { openCompose } = useComposeWindow();

  useEffect(() => {
    const to = searchParams.get("to") || "";
    const subject = searchParams.get("subject") || "";
    const body = searchParams.get("body") || "";
    const draftId = searchParams.get("draft") || undefined;
    openCompose({ to, subject, body, draftId });
    // Small delay so compose state propagates before unmount
    const timer = setTimeout(() => navigate("/", { replace: true }), 50);
    return () => clearTimeout(timer);
  }, []);

  return (
    <AppLayout>
      <div className="flex-1 flex items-center justify-center text-muted-foreground">
        Redirection…
      </div>
    </AppLayout>
  );
};

export default Compose;

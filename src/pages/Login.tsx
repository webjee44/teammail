import { useState } from "react";
import { Mail } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { lovable } from "@/integrations/lovable/index";
import { toast } from "sonner";

const Login = () => {
  const { session, loading } = useAuth();
  const navigate = useNavigate();
  const [signingIn, setSigningIn] = useState(false);

  useEffect(() => {
    if (session) navigate("/", { replace: true });
  }, [session, navigate]);

  const handleGoogleLogin = async () => {
    setSigningIn(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
        extraParams: {
          hd: "cloudvapor.com",
          prompt: "select_account",
        },
      });
      if (result.error) {
        toast.error("Erreur de connexion : " + result.error.message);
        return;
      }
      if (result.redirected) return;
      navigate("/", { replace: true });
    } catch (err: any) {
      toast.error("Erreur : " + (err.message || String(err)));
    } finally {
      setSigningIn(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="w-full max-w-md space-y-8 px-6">
        <div className="text-center space-y-3">
          <div className="mx-auto w-16 h-16 rounded-2xl bg-primary flex items-center justify-center">
            <Mail className="h-8 w-8 text-primary-foreground" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">TeamMail</h1>
          <p className="text-muted-foreground text-sm">
            Boîte mail collaborative pour votre équipe
          </p>
        </div>

        <Button
          onClick={handleGoogleLogin}
          disabled={signingIn}
          className="w-full gap-2"
          size="lg"
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          {signingIn ? "Connexion..." : "Se connecter avec Google"}
        </Button>

        <p className="text-center text-xs text-muted-foreground">
          Contactez votre administrateur pour obtenir un accès.
        </p>
      </div>
    </div>
  );
};

export default Login;

import { createContext, useContext, useState, useCallback, ReactNode } from "react";

type InitialAttachment = {
  name: string;
  file: File;
  base64: string;
};

type ComposeState = {
  isOpen: boolean;
  isMinimized: boolean;
  initialTo?: string;
  initialSubject?: string;
  initialBody?: string;
  draftId?: string;
  initialAttachments?: InitialAttachment[];
};

type ComposeWindowContextType = {
  state: ComposeState;
  openCompose: (params?: { to?: string; subject?: string; body?: string; draftId?: string; attachments?: InitialAttachment[] }) => void;
  closeCompose: () => void;
  toggleMinimize: () => void;
};

const ComposeWindowContext = createContext<ComposeWindowContextType | null>(null);

export function ComposeWindowProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ComposeState>({ isOpen: false, isMinimized: false });

  const openCompose = useCallback((params?: { to?: string; subject?: string; body?: string; draftId?: string; attachments?: InitialAttachment[] }) => {
    setState({
      isOpen: true,
      isMinimized: false,
      initialTo: params?.to || "",
      initialSubject: params?.subject || "",
      initialBody: params?.body || "",
      draftId: params?.draftId,
      initialAttachments: params?.attachments,
    });
  }, []);

  const closeCompose = useCallback(() => {
    setState({ isOpen: false, isMinimized: false });
  }, []);

  const toggleMinimize = useCallback(() => {
    setState((prev) => ({ ...prev, isMinimized: !prev.isMinimized }));
  }, []);

  return (
    <ComposeWindowContext.Provider value={{ state, openCompose, closeCompose, toggleMinimize }}>
      {children}
    </ComposeWindowContext.Provider>
  );
}

export function useComposeWindow() {
  const ctx = useContext(ComposeWindowContext);
  if (!ctx) throw new Error("useComposeWindow must be used within ComposeWindowProvider");
  return ctx;
}

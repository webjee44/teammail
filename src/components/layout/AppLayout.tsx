import { ReactNode } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { InboxSidebar } from "@/components/inbox/InboxSidebar";

type Props = {
  children: ReactNode;
  hideHeader?: boolean;
};

export function AppLayout({ children, hideHeader }: Props) {
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <InboxSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          {!hideHeader && (
            <header className="h-12 flex items-center border-b border-border px-2 shrink-0">
              <SidebarTrigger className="ml-1" />
            </header>
          )}
          <main className="flex-1 flex min-h-0 justify-center">
            <div className="w-full max-w-screen-2xl">{children}</div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

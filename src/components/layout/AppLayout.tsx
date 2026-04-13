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
        <div className="flex w-full bg-background">
          <InboxSidebar />
          <div className="flex-1 flex flex-col min-w-0">
            {!hideHeader && (
              <header className="h-12 flex items-center border-b border-border px-2 shrink-0">
                <SidebarTrigger className="ml-1" />
              </header>
            )}
            <main className="flex-1 flex min-h-0">
              {children}
            </main>
          </div>
        </div>
      </div>
    </SidebarProvider>
  );
}

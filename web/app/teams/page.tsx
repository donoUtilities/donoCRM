import { AppSidebar } from "@/components/app-sidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { TeamsContent } from "./teams-content";

export default function TeamsPage() {
  return (
    <SidebarProvider>
      <AppSidebar variant="inset" />
      <SidebarInset>
        <div className="flex flex-1 flex-col min-h-0 h-full">
          <TeamsContent />
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

import { AppSidebar } from "@/components/app-sidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { DtapDetailContent } from "./dtap-detail-content";

export default function DtapDetailPage() {
  return (
    <SidebarProvider>
      <AppSidebar variant="inset" />
      <SidebarInset>
        <div className="flex flex-1 flex-col min-h-0 h-full">
          <DtapDetailContent />
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

import { AppSidebar } from "@/components/app-sidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { BspdDetailContent } from "./bspd-detail-content";

export default function BspdDetailPage() {
  return (
    <SidebarProvider>
      <AppSidebar variant="inset" />
      <SidebarInset>
        <div className="flex flex-1 flex-col min-h-0 h-full">
          <BspdDetailContent />
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

import { AppSidebar } from "@/components/app-sidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { WireCentersContent } from "./wire-centers-content";

export default function WireCentersPage() {
  return (
    <SidebarProvider>
      <AppSidebar variant="inset" />
      <SidebarInset>
        <div className="flex flex-1 flex-col min-h-0 h-full">
          <WireCentersContent />
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

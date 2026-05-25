import { Suspense } from "react";
import { AppSidebar } from "@/components/app-sidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { DtapContent } from "./dtap-content";

export default function DtapPage() {
  return (
    <SidebarProvider>
      <AppSidebar variant="inset" />
      <SidebarInset>
        <div className="flex flex-1 flex-col min-h-0 h-full">
          <Suspense>
            <DtapContent />
          </Suspense>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

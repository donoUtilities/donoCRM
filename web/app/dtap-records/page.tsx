import { Suspense } from "react";
import { AppSidebar } from "@/components/app-sidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { DtapRecordsContent } from "./dtap-records-content";

export default function DtapRecordsPage() {
  return (
    <SidebarProvider>
      <AppSidebar variant="inset" />
      <SidebarInset>
        <div className="flex flex-1 flex-col min-h-0 h-full">
          <Suspense>
            <DtapRecordsContent />
          </Suspense>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

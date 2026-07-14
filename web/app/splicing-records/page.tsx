import { Suspense } from "react";
import { AppSidebar } from "@/components/app-sidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { SplicingRecordsContent } from "./splicing-records-content";

export default function SplicingRecordsPage() {
  return (
    <SidebarProvider>
      <AppSidebar variant="inset" />
      <SidebarInset>
        <div className="flex flex-1 flex-col min-h-0 h-full">
          <Suspense>
            <SplicingRecordsContent />
          </Suspense>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

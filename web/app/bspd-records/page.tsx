import { Suspense } from "react";
import { AppSidebar } from "@/components/app-sidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { BspdRecordsContent } from "./bspd-records-content";

export default function BspdRecordsPage() {
  return (
    <SidebarProvider>
      <AppSidebar variant="inset" />
      <SidebarInset>
        <div className="flex flex-1 flex-col min-h-0 h-full">
          <Suspense>
            <BspdRecordsContent />
          </Suspense>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

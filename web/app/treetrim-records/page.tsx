import { Suspense } from "react";
import { AppSidebar } from "@/components/app-sidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { TreeTrimRecordsContent } from "./treetrim-records-content";

export default function TreeTrimRecordsPage() {
  return (
    <SidebarProvider>
      <AppSidebar variant="inset" />
      <SidebarInset>
        <div className="flex flex-1 flex-col min-h-0 h-full">
          <Suspense>
            <TreeTrimRecordsContent />
          </Suspense>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

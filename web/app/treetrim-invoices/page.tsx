import { Suspense } from "react";
import { AppSidebar } from "@/components/app-sidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { TreeTrimInvoicesContent } from "./treetrim-invoices-content";

export default function TreeTrimInvoicesPage() {
  return (
    <SidebarProvider>
      <AppSidebar variant="inset" />
      <SidebarInset>
        <div className="flex flex-1 flex-col min-h-0 h-full">
          <Suspense>
            <TreeTrimInvoicesContent />
          </Suspense>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

import { Suspense } from "react";
import { AppSidebar } from "@/components/app-sidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { DtapInvoicesContent } from "./dtap-invoices-content";

export default function DtapInvoicesPage() {
  return (
    <SidebarProvider>
      <AppSidebar variant="inset" />
      <SidebarInset>
        <div className="flex flex-1 flex-col min-h-0 h-full">
          <Suspense>
            <DtapInvoicesContent />
          </Suspense>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

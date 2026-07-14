import { Suspense } from "react";
import { AppSidebar } from "@/components/app-sidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { SplicingInvoicesContent } from "./splicing-invoices-content";

export default function SplicingInvoicesPage() {
  return (
    <SidebarProvider>
      <AppSidebar variant="inset" />
      <SidebarInset>
        <div className="flex flex-1 flex-col min-h-0 h-full">
          <Suspense>
            <SplicingInvoicesContent />
          </Suspense>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

import { Suspense } from "react";
import { AppSidebar } from "@/components/app-sidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { BspdInvoicesContent } from "./bspd-invoices-content";

export default function BspdInvoicesPage() {
  return (
    <SidebarProvider>
      <AppSidebar variant="inset" />
      <SidebarInset>
        <div className="flex flex-1 flex-col min-h-0 h-full">
          <Suspense>
            <BspdInvoicesContent />
          </Suspense>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

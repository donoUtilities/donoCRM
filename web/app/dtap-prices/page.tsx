import { Suspense } from "react";
import { AppSidebar } from "@/components/app-sidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { DtapPricesContent } from "./dtap-prices-content";

export default function DtapPricesPage() {
  return (
    <SidebarProvider>
      <AppSidebar variant="inset" />
      <SidebarInset>
        <div className="flex flex-1 flex-col min-h-0 h-full">
          <Suspense>
            <DtapPricesContent />
          </Suspense>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

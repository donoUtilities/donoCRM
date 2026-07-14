import { Suspense } from "react";
import { AppSidebar } from "@/components/app-sidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { SplicingPricesContent } from "./splicing-prices-content";

export default function SplicingPricesPage() {
  return (
    <SidebarProvider>
      <AppSidebar variant="inset" />
      <SidebarInset>
        <div className="flex flex-1 flex-col min-h-0 h-full">
          <Suspense>
            <SplicingPricesContent />
          </Suspense>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

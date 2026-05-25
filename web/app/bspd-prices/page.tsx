import { Suspense } from "react";
import { AppSidebar } from "@/components/app-sidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { BspdPricesContent } from "./bspd-prices-content";

export default function BspdPricesPage() {
  return (
    <SidebarProvider>
      <AppSidebar variant="inset" />
      <SidebarInset>
        <div className="flex flex-1 flex-col min-h-0 h-full">
          <Suspense>
            <BspdPricesContent />
          </Suspense>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

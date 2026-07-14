import { Suspense } from "react";
import { AppSidebar } from "@/components/app-sidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { TreeTrimPricesContent } from "./treetrim-prices-content";

export default function TreeTrimPricesPage() {
  return (
    <SidebarProvider>
      <AppSidebar variant="inset" />
      <SidebarInset>
        <div className="flex flex-1 flex-col min-h-0 h-full">
          <Suspense>
            <TreeTrimPricesContent />
          </Suspense>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

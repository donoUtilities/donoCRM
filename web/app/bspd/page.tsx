import { Suspense } from "react";
import { AppSidebar } from "@/components/app-sidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { BspdContent } from "./bspd-content";

export default function BspdPage() {
  return (
    <SidebarProvider>
      <AppSidebar variant="inset" />
      <SidebarInset>
        <div className="flex flex-1 flex-col min-h-0 h-full">
          <Suspense>
            <BspdContent />
          </Suspense>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

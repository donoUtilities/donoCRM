import { AppSidebar } from "@/components/app-sidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { FiberLoadingAnimation } from "@/components/fiber-loading";

export default function Loading() {
  return (
    <SidebarProvider>
      <AppSidebar variant="inset" />
      <SidebarInset>
        <div className="flex flex-1 flex-col items-center justify-center min-h-0 h-full">
          <FiberLoadingAnimation />
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

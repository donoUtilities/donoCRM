import { AppSidebar } from "@/components/app-sidebar";
import { ChartAreaInteractive } from "@/components/chart-area-interactive";
import { PageHeader } from "@/components/page-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";

export default function Page() {
  return (
    <SidebarProvider>
      <AppSidebar variant="inset" />
      <SidebarInset>
        <div className="flex flex-1 flex-col min-h-0 h-full">
          <PageHeader
            title="Dashboard"
            description="Overview of your analytics"
          />
          <div className="flex-1 overflow-auto px-4 py-2">
            <ChartAreaInteractive />
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

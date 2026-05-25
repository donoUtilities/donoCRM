import { auth } from "@/auth";
import { redirect } from "next/navigation";

import { AppSidebar } from "@/components/app-sidebar";
import { PageHeader } from "@/components/page-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

export default async function ProfilePage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const { name, email, image, designation } = session.user;

  return (
    <SidebarProvider>
      <AppSidebar variant="inset" />
      <SidebarInset>
        <div className="flex flex-1 flex-col min-h-0 h-full">
          <PageHeader
            title="Profile"
            description="Your account information"
          />
          <div className="flex-1 overflow-auto p-2">
            <Card className="max-w-lg">
              <CardHeader className="flex flex-row items-center gap-4">
                {image ? (
                  <img
                    src={image}
                    alt={name || "User"}
                    className="size-16 rounded-full"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="flex size-16 items-center justify-center rounded-full bg-muted text-xl font-semibold">
                    {name?.charAt(0) || "U"}
                  </div>
                )}
                <div>
                  <CardTitle className="text-lg">{name}</CardTitle>
                  {designation && (
                    <p className="text-sm text-muted-foreground">{designation}</p>
                  )}
                </div>
              </CardHeader>
              <Separator />
              <CardContent className="pt-6">
                <dl className="space-y-4">
                  <div>
                    <dt className="text-sm font-medium text-muted-foreground">
                      Email
                    </dt>
                    <dd className="text-sm">{email}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-muted-foreground">
                      Name
                    </dt>
                    <dd className="text-sm">{name}</dd>
                  </div>
                  {designation && (
                    <div>
                      <dt className="text-sm font-medium text-muted-foreground">
                        Designation
                      </dt>
                      <dd className="text-sm">{designation}</dd>
                    </div>
                  )}
                </dl>
              </CardContent>
            </Card>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

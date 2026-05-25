"use client";

import * as React from "react";
import Link from "next/link";
import {
  IconBolt,
  IconCurrencyDollar,
  IconDatabase,
  IconFileSpreadsheet,
  IconLogin,
  IconLogout,
  IconMoon,
  IconReceipt,
  IconSettings,
  IconMapPin,
  IconSun,
  IconUser,
  IconUsers,
  IconUsersGroup,
} from "@tabler/icons-react";
import { useTheme } from "next-themes";
import { useSession, signOut } from "next-auth/react";

import { NavMain } from "@/components/nav-main";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

const data = {
  navMain: [
    {
      title: "Users",
      url: "/users",
      icon: IconUsers,
    },
    {
      title: "Teams",
      url: "/teams",
      icon: IconUsersGroup,
    },
    {
      title: "Wire Centers",
      url: "/wire-centers",
      icon: IconMapPin,
    },
  ],
  groups: [
    {
      title: "DTAP",
      icon: IconFileSpreadsheet,
      items: [
        { title: "Items", url: "/dtap", icon: IconFileSpreadsheet },
        { title: "Records", url: "/dtap-records", icon: IconDatabase },
        { title: "Invoices", url: "/dtap-invoices", icon: IconReceipt },
        { title: "Prices", url: "/dtap-prices", icon: IconCurrencyDollar },
      ],
    },
    {
      title: "BSPD",
      icon: IconBolt,
      items: [
        { title: "Items", url: "/bspd", icon: IconFileSpreadsheet },
        { title: "Records", url: "/bspd-records", icon: IconDatabase },
        { title: "Invoices", url: "/bspd-invoices", icon: IconReceipt },
        { title: "Prices", url: "/bspd-prices", icon: IconCurrencyDollar },
      ],
    },
  ],
};

function ModeSwitcherItem() {
  const { setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => setMounted(true), []);

  const isDark = resolvedTheme === "dark";

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        onClick={() => setTheme(isDark ? "light" : "dark")}
      >
        {mounted && isDark ? <IconSun /> : <IconMoon />}
        <span>{mounted ? (isDark ? "Light Mode" : "Dark Mode") : "Toggle Mode"}</span>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

function SidebarUserFooter() {
  const { data: session, status } = useSession();

  if (status === "loading") {
    return null;
  }

  if (session?.user) {
    const designation = session.user.designation;

    return (
      <SidebarMenu>
        <SidebarMenuItem>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <SidebarMenuButton className="h-auto">
                <IconUser className="shrink-0" />
                <div className="flex flex-col leading-tight">
                  <span className="text-sm font-medium">{session.user.name}</span>
                  {designation && (
                    <span className="text-xs text-muted-foreground">{designation}</span>
                  )}
                </div>
              </SidebarMenuButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="top" align="start" className="w-48">
              <DropdownMenuItem asChild>
                <Link href="/profile">
                  <IconUser className="mr-2 size-4" />
                  Profile
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => signOut({ callbackUrl: "/login" })}>
                <IconLogout className="mr-2 size-4" />
                Logout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </SidebarMenuItem>
      </SidebarMenu>
    );
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton asChild>
          <Link href="/login">
            <IconLogin />
            <span>Login</span>
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              className="data-[slot=sidebar-menu-button]:!p-1.5"
            >
              <Link href="/">
                <img
                  src="/logo.png"
                  alt="Dono Utilities"
                  className="h-8 w-auto"
                />
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={data.navMain} groups={data.groups} />
        <SidebarGroup className="mt-auto">
          <SidebarGroupContent>
            <SidebarMenu>
              <ModeSwitcherItem />
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <Link href="#">
                    <IconSettings />
                    <span>Settings</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <SidebarUserFooter />
      </SidebarFooter>
    </Sidebar>
  );
}


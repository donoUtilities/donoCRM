"use client"

import { usePathname } from "next/navigation"
import { type Icon } from "@tabler/icons-react"
import { cn } from "@/lib/utils"

import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

type NavItem = {
  title: string
  url: string
  icon?: Icon
}

type NavGroup = {
  title: string
  icon?: Icon
  items: NavItem[]
}

export function NavMain({
  items,
  groups,
}: {
  items: NavItem[]
  groups?: NavGroup[]
}) {
  const pathname = usePathname()

  return (
    <SidebarGroup>
      <SidebarGroupContent className="flex flex-col gap-2">
        <SidebarMenu>
          {items.map((item) => {
            const isActive =
              pathname === item.url ||
              (item.url !== "/dashboard" && pathname.startsWith(item.url + "/"))
            return (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton asChild tooltip={item.title} isActive={isActive}>
                  <a href={item.url}>
                    {item.icon && <item.icon />}
                    <span>{item.title}</span>
                  </a>
                </SidebarMenuButton>
              </SidebarMenuItem>
            )
          })}
        </SidebarMenu>

        {groups?.map((group) => {
          const isGroupActive = group.items.some(
            (item) =>
              pathname === item.url ||
              pathname.startsWith(item.url + "/")
          )
          return (
            <div key={group.title}>
              <SidebarGroupLabel className="flex items-center gap-2 text-[11px] font-semibold tracking-wider uppercase text-muted-foreground/70 px-2 mb-1">
                {group.icon && <group.icon className="size-3.5" />}
                {group.title}
              </SidebarGroupLabel>
              <SidebarMenu>
                <div className={cn(
                  "relative ml-3 border-l-2 pl-0 transition-colors duration-200",
                  isGroupActive ? "border-primary" : "border-border"
                )}>
                  {group.items.map((item) => {
                    const isActive =
                      pathname === item.url ||
                      pathname.startsWith(item.url + "/")
                    return (
                      <SidebarMenuItem key={item.title}>
                        <SidebarMenuButton
                          asChild
                          tooltip={item.title}
                          isActive={isActive}
                          className={cn(
                            "ml-2 transition-all duration-150",
                            isActive && "bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground font-medium"
                          )}
                        >
                          <a href={item.url}>
                            {item.icon && <item.icon className="size-4" />}
                            <span>{item.title}</span>
                          </a>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    )
                  })}
                </div>
              </SidebarMenu>
            </div>
          )
        })}
      </SidebarGroupContent>
    </SidebarGroup>
  )
}

"use client";

import { SessionProvider, useSession } from "next-auth/react";
import { usePathname, useRouter } from "next/navigation";
import React from "react";

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { status } = useSession();
  const pathname = usePathname();
  const router = useRouter();
  const isLoginPage = pathname === "/login";

  React.useEffect(() => {
    if (status === "unauthenticated" && !isLoginPage) {
      router.replace("/login");
    }
  }, [status, isLoginPage, router]);

  // Login page is always accessible
  if (isLoginPage) return <>{children}</>;

  // Show nothing while checking session
  if (status === "loading") return null;

  // Not authenticated — will redirect via useEffect
  if (status === "unauthenticated") return null;

  return <>{children}</>;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <AuthGuard>{children}</AuthGuard>
    </SessionProvider>
  );
}

"use client";

import { SessionProvider, useSession } from "next-auth/react";
import { usePathname, useRouter } from "next/navigation";
import React from "react";

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { status } = useSession();
  const pathname = usePathname();
  const router = useRouter();
  const isLoginPage = pathname === "/login";

  // Track whether we have ever been authenticated so we can
  // keep children mounted during transient "loading" re-checks
  // instead of unmounting the entire subtree (which triggers
  // Next.js to re-fetch the RSC page tree → infinite loop).
  const wasAuthenticated = React.useRef(false);
  if (status === "authenticated") {
    wasAuthenticated.current = true;
  }

  React.useEffect(() => {
    if (status === "unauthenticated" && !isLoginPage) {
      router.replace("/login");
    }
  }, [status, isLoginPage, router]);

  // Login page is always accessible
  if (isLoginPage) return <>{children}</>;

  // Not authenticated — will redirect via useEffect
  if (status === "unauthenticated") return null;

  // Initial load — never been authenticated yet, show nothing
  if (status === "loading" && !wasAuthenticated.current) return null;

  // Either authenticated, or a transient re-check after having been
  // authenticated — keep children mounted to avoid RSC re-fetches.
  return <>{children}</>;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider
      refetchInterval={0}
      refetchOnWindowFocus={false}
      refetchWhenOffline={false}
    >
      <AuthGuard>{children}</AuthGuard>
    </SessionProvider>
  );
}

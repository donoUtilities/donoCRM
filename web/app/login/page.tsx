import { LoginForm } from "./login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="flex w-full max-w-sm flex-col items-center gap-8 px-6">
        <img
          src="/animation.gif"
          alt="Welcome"
          className="h-48 w-auto"
        />
        <div className="flex flex-col items-center gap-2 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">
            Welcome back
          </h1>
          <p className="text-sm text-muted-foreground">
            Sign in to continue to Dono Utilities
          </p>
        </div>
        {error && (
          <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-center">
            <p className="text-sm font-medium text-destructive">
              You are not authorised to access this application.
            </p>
          </div>
        )}
        <LoginForm />
      </div>
    </div>
  );
}

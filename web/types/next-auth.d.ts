import "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      name?: string | null;
      email?: string | null;
      image?: string | null;
      designation?: string;
    };
    accessToken?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    designation?: string;
    accessToken?: string;
    refreshToken?: string;
    expiresAt?: number;
  }
}

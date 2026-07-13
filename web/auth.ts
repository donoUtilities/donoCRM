import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import clientPromise from "@/lib/mongodb";
import { env } from "@/lib/env";

const DB_NAME = "DonoUtilities";
const COLLECTION = "DonoUtilities_Users";

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Google({
      authorization: {
        params: {
          scope:
            "openid email profile https://www.googleapis.com/auth/documents https://www.googleapis.com/auth/drive",
          access_type: "offline",
          prompt: "select_account",
        },
      },
    }),
  ],
  pages: {
    signIn: "/login",
    error: "/login",
  },
  callbacks: {
    async signIn({ user }) {
      try {
        const client = await clientPromise;
        const db = client.db(DB_NAME);
        const dbUser = await db.collection(COLLECTION).findOne({
          email: user.email,
          status: "Active",
        });

        if (!dbUser) {
          // Deny login — user not found or not active
          return false;
        }

        return true;
      } catch (error) {
        console.error("MongoDB sign-in check failed:", error);
        return false;
      }
    },

    async jwt({ token, trigger, account }) {
      // Capture Google tokens on initial sign-in
      if (account) {
        token.accessToken = account.access_token;
        token.refreshToken = account.refresh_token;
        token.expiresAt = account.expires_at;
      }

      // On initial sign-in or whenever we need to refresh user data
      if (trigger === "signIn" || token.designation === undefined) {
        try {
          const client = await clientPromise;
          const db = client.db(DB_NAME);
          const dbUser = await db.collection(COLLECTION).findOne({
            email: token.email,
            status: "Active",
          });

          if (dbUser) {
            token.id = dbUser._id.toString();
            token.name = dbUser.name || token.name;
            token.designation = dbUser.designation || "";
          }
        } catch (error) {
          console.error("MongoDB JWT enrichment failed:", error);
        }
      }

      // If access token has expired, refresh it
      if (token.expiresAt && Date.now() / 1000 > (token.expiresAt as number)) {
        try {
          const response = await fetch("https://oauth2.googleapis.com/token", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
              client_id: env.AUTH_GOOGLE_ID,
              client_secret: env.AUTH_GOOGLE_SECRET,
              grant_type: "refresh_token",
              refresh_token: token.refreshToken as string,
            }),
          });
          const data = await response.json();
          if (data.access_token) {
            token.accessToken = data.access_token;
            token.expiresAt = Math.floor(Date.now() / 1000) + data.expires_in;
          }
        } catch (error) {
          console.error("Token refresh failed:", error);
        }
      }

      return token;
    },

    async session({ session, token }) {
      // Expose ONLY safe fields to the client session
      session.user.id = token.id as string;
      session.user.name = token.name as string;
      session.user.designation = token.designation as string;
      // NOTE: accessToken is intentionally NOT exposed here.
      // It lives on the JWT and server-side routes read it via getToken().
      return session;
    },
  },
});

import NextAuth, { DefaultSession } from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import { verifyCredentials } from "@/lib/verify-credentials";

declare module "next-auth" {
  interface Session {
    user: { id: string } & DefaultSession["user"];
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Google,
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        rememberToken: { label: "Demo token", type: "text" },
        useSavedSignIn: { label: "Use saved sign-in", type: "text" },
      },
      /** Verifies credentials (email+password, a demo token, or the saved sign-in cookie) and returns the user on success. */
      authorize: verifyCredentials,
    }),
  ],
  session: { strategy: "jwt" as const },
  pages: { signIn: "/login" },
  callbacks: {
    jwt({ token, account, profile }) {
      if (account && profile) {
        token.sub = (profile as { sub: string }).sub;
      }
      return token;
    },
    session({ session, token }) {
      session.user.id = token.sub!;
      return session;
    },
  },
});

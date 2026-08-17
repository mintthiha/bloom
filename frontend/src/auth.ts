import NextAuth, { DefaultSession } from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";

declare module "next-auth" {
  interface Session {
    user: { id: string } & DefaultSession["user"];
  }
}

const BACKEND = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Google,
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      /** Verifies email/password against the backend and returns the user on success. */
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        try {
          const res = await fetch(`${BACKEND}/api/credentials-auth/verify`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-Internal-Secret": process.env.INTERNAL_API_SECRET ?? "",
            },
            body: JSON.stringify({ email: credentials.email, password: credentials.password }),
          });
          if (!res.ok) return null;
          const user = await res.json();
          return { id: user.id, email: user.email, name: user.email };
        } catch {
          return null;
        }
      },
    }),
  ],
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

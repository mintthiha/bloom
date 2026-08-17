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
        rememberToken: { label: "Remember-me token", type: "text" },
      },
      /** Verifies credentials (email+password or a remember-me token) and returns the user on success. */
      async authorize(credentials) {
        const secret = process.env.INTERNAL_API_SECRET ?? "";
        const headers = { "Content-Type": "application/json", "X-Internal-Secret": secret };

        try {
          // Remember-me token path — no password needed.
          if (credentials?.rememberToken) {
            const res = await fetch(`${BACKEND}/api/credentials-auth/remember/verify`, {
              method: "POST",
              headers,
              body: JSON.stringify({ token: credentials.rememberToken }),
            });
            if (!res.ok) return null;
            const user = await res.json();
            const localPart = (user.email as string).split("@")[0];
            return { id: user.id, email: user.email, name: localPart };
          }

          // Email + password path.
          if (!credentials?.email || !credentials?.password) return null;
          const res = await fetch(`${BACKEND}/api/credentials-auth/verify`, {
            method: "POST",
            headers,
            body: JSON.stringify({ email: credentials.email, password: credentials.password }),
          });
          if (!res.ok) return null;
          const user = await res.json();
          const localPart = (user.email as string).split("@")[0];
          return { id: user.id, email: user.email, name: localPart };
        } catch {
          return null;
        }
      },
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

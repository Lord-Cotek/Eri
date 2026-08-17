import type { NextAuthOptions } from "next-auth";
import EmailProvider from "next-auth/providers/email";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  session: { strategy: "database" },
  pages: { signIn: "/signin", verifyRequest: "/signin?sent=1" },
  providers: [
    EmailProvider({
      server: process.env.EMAIL_SERVER ?? "",
      from: process.env.EMAIL_FROM ?? "no-reply@cotek.live",
      // With no SMTP configured in development, print the sign-in link to the
      // server console instead of failing. Guarded on NODE_ENV as well as the
      // missing server, so a production deploy that has lost its mail config
      // fails loudly rather than printing sign-in links into a log aggregator.
      ...(process.env.EMAIL_SERVER || process.env.NODE_ENV === "production"
        ? {}
        : {
            sendVerificationRequest({ identifier, url }: { identifier: string; url: string }) {
              console.info(`\n[auth] sign-in link for ${identifier}:\n${url}\n`);
            },
          }),
    }),
  ],
  callbacks: {
    // The whole app authorises on user id, so put it on the session once here
    // rather than re-looking it up in every route.
    session({ session, user }) {
      if (session.user) session.user.id = user.id;
      return session;
    },
  },
};

/** The signed-in user's id, or null. Server-side only. */
export async function currentUserId(): Promise<string | null> {
  const session = await getServerSession(authOptions);
  return session?.user?.id ?? null;
}

/** The signed-in user's id, or throw. For routes that have already checked. */
export async function requireUserId(): Promise<string> {
  const id = await currentUserId();
  if (!id) throw new Error("UNAUTHENTICATED");
  return id;
}

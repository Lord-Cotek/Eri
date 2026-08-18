import type { NextAuthOptions } from "next-auth";
import EmailProvider from "next-auth/providers/email";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { blank } from "@/lib/env";
import { mailTransport, sendMail } from "@/lib/mailer";

/**
 * The sign-in email.
 *
 * Plain text, in Ẹ̀rí's voice. No marketing, no logo, nothing that would look
 * out of place sitting in an inbox somebody else might glance at.
 */
const SIGN_IN_TEXT = (url: string): string =>
  [
    "Here is your sign-in link. It works once, and it expires.",
    "",
    url,
    "",
    "If you did not ask for this, nothing has happened and you can ignore it.",
  ].join("\n");

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  session: { strategy: "database" },
  pages: { signIn: "/signin", verifyRequest: "/signin?sent=1" },
  providers: [
    EmailProvider({
      // `server` and `from` are unused: sendVerificationRequest below replaces
      // nodemailer entirely, so the link goes out through the same transport as
      // every other message Ẹ̀rí sends — Resend if configured, SMTP otherwise.
      server: "",
      from: blank(process.env.EMAIL_FROM) ?? "no-reply@cotek.app",
      async sendVerificationRequest({ identifier, url }) {
        // No SMTP and no Resend, in development: print the link rather than
        // fail, so the app is runnable without a mail account. `lib/env.ts`
        // requires a transport in production, so this branch cannot be reached
        // there.
        if (mailTransport() === "console") {
          console.info(`\n[auth] sign-in link for ${identifier}:\n${url}\n`);
          return;
        }

        const sent = await sendMail({
          to: identifier,
          subject: "Ẹ̀rí — your sign-in link",
          text: SIGN_IN_TEXT(url),
        });

        // NextAuth shows the "check your inbox" page unless this throws. It
        // should not say a link is on its way when nothing was sent.
        if (!sent) throw new Error("Could not send the sign-in link.");
      },
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

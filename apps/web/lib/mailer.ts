/**
 * Outbound mail. One transport decision, made once.
 *
 * Order of preference:
 *
 *   1. `RESEND_API_KEY` — HTTPS to the Resend API. Preferred on Vercel: a
 *      serverless function makes one ordinary HTTPS request instead of holding
 *      an SMTP socket open across a cold start.
 *   2. `EMAIL_SERVER` — SMTP via nodemailer, for anyone not using Resend.
 *   3. Neither, in development — the message is printed to the server console
 *      so the whole covenant is demonstrable without a mail account.
 *
 * In production, `lib/env.ts` requires one of the first two; the console
 * fallback is unreachable there.
 *
 * PRIVACY INVARIANT: every body reaching this module was assembled from a fixed
 * template in `lib/notify.ts`. This module does not compose copy and must never
 * start — it is a transport, not an author.
 */

import "server-only";

import nodemailer from "nodemailer";

import { blank } from "@/lib/env";

export type Mail = { to: string; subject: string; text: string; html?: string };

function from(): string {
  return blank(process.env.EMAIL_FROM) ?? "no-reply@cotek.app";
}

/* ------------------------------------------------------------------ */
/* Resend                                                              */
/* ------------------------------------------------------------------ */

/**
 * Sent with `fetch` rather than the SDK.
 *
 * It is one POST, and a transport this small does not justify a dependency
 * whose major versions we would then have to track.
 */
async function sendViaResend(mail: Mail, apiKey: string): Promise<boolean> {
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        from: from(),
        to: [mail.to],
        subject: mail.subject,
        text: mail.text,
        ...(mail.html ? { html: mail.html } : {}),
      }),
    });

    if (response.ok) return true;

    // Resend's errors are specific and worth keeping — a wrong `from` domain is
    // the usual cause and says so plainly.
    console.error(`[mail] resend rejected the message (${response.status})`, await response.text());
    return false;
  } catch (error) {
    console.error("[mail] resend request failed", error);
    return false;
  }
}

/* ------------------------------------------------------------------ */
/* SMTP                                                                */
/* ------------------------------------------------------------------ */

let transport: nodemailer.Transporter | null = null;

async function sendViaSmtp(mail: Mail, server: string): Promise<boolean> {
  try {
    transport ??= nodemailer.createTransport(server);
    await transport.sendMail({ from: from(), to: mail.to, subject: mail.subject, text: mail.text, html: mail.html });
    return true;
  } catch (error) {
    console.error("[mail] smtp send failed", error);
    return false;
  }
}

/* ------------------------------------------------------------------ */
/* The one entry point                                                 */
/* ------------------------------------------------------------------ */

export function mailTransport(): "resend" | "smtp" | "console" {
  if (blank(process.env.RESEND_API_KEY)) return "resend";
  if (blank(process.env.EMAIL_SERVER)) return "smtp";
  return "console";
}

/** Returns whether the message was actually handed to a transport. */
export async function sendMail(mail: Mail): Promise<boolean> {
  const resendKey = blank(process.env.RESEND_API_KEY);
  if (resendKey) return sendViaResend(mail, resendKey);

  const smtp = blank(process.env.EMAIL_SERVER);
  if (smtp) return sendViaSmtp(mail, smtp);

  console.info(`[mail] (no transport configured) → ${mail.to}: ${mail.subject}\n${mail.text}\n`);
  return false;
}

/**
 * Runs once when the server starts, before it accepts a request.
 *
 * Its only job is to pull in `lib/env`, which throws if required configuration
 * is missing — so a misconfigured deployment fails loudly at boot instead of
 * serving a page that tells a man in crisis to call nobody.
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("@/lib/env");
  }
}

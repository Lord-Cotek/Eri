/**
 * Canonical JSON serialisation.
 *
 * Both the signer and the verifier must agree byte-for-byte on what was signed.
 * JSON.stringify does not guarantee key order across implementations, so we
 * define it: object keys sorted lexicographically by UTF-16 code unit, no
 * insignificant whitespace, arrays in their given order.
 *
 * Swift and Kotlin transcriptions must reproduce exactly this. See
 * docs/PROTOCOL.md § Canonicalisation.
 */

export type JsonPrimitive = string | number | boolean | null;
export type JsonObject = { [key: string]: JsonValue };
export type JsonValue = JsonPrimitive | JsonValue[] | JsonObject;

export function canonicalize(value: JsonValue): string {
  if (value === null) return "null";

  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new Error("canonicalize: non-finite numbers cannot be signed");
    }
    // JSON.stringify already emits the shortest round-tripping form.
    return JSON.stringify(value);
  }

  if (typeof value === "boolean" || typeof value === "string") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map(canonicalize).join(",")}]`;
  }

  const keys = Object.keys(value)
    .filter((k) => value[k] !== undefined)
    .sort();

  const body = keys
    .map((k) => `${JSON.stringify(k)}:${canonicalize(value[k] as JsonValue)}`)
    .join(",");

  return `{${body}}`;
}

/** The exact bytes that get signed and verified. */
export function canonicalBytes(value: JsonValue): Uint8Array {
  return new TextEncoder().encode(canonicalize(value));
}

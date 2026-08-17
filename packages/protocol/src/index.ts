/**
 * @eri/protocol — the Ẹ̀rí sentinel wire protocol.
 *
 * The simulator and the future native sentinels are the same kind of client.
 * They share this package so they cannot drift.
 *
 * Import surface:
 *
 *   @eri/protocol           vocabulary, schemas, state machine — isomorphic,
 *                           safe in a browser bundle
 *   @eri/protocol/signing   Ed25519 helpers — requires node:crypto, server and
 *                           device only
 *   @eri/protocol/client    a signing HTTP client for sentinels
 *
 * See docs/PROTOCOL.md for the field-by-field reference, and
 * docs/PRIVACY-INVARIANTS.md for what may never appear here.
 */

export * from "./categories.js";
export * from "./canonical.js";
export * from "./schemas.js";
export * from "./state-machine.js";

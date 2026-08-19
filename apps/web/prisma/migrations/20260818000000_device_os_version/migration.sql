-- The OS a sentinel runs on. Support triage only: a platform version,
-- never a device fingerprint, and never shown to the ally.
ALTER TABLE "Device" ADD COLUMN "osVersion" TEXT;

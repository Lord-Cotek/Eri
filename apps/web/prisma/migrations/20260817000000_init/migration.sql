-- CreateEnum
CREATE TYPE "CovenantStatus" AS ENUM ('PENDING', 'ACTIVE', 'REVOKED', 'DECLINED');

-- CreateEnum
CREATE TYPE "ActorRole" AS ENUM ('SUBJECT', 'ALLY', 'SYSTEM');

-- CreateEnum
CREATE TYPE "DevicePlatform" AS ENUM ('IOS', 'ANDROID', 'MACOS', 'WINDOWS', 'SIMULATOR');

-- CreateEnum
CREATE TYPE "DeviceStatus" AS ENUM ('ACTIVE', 'SILENT', 'RETIRED');

-- CreateEnum
CREATE TYPE "EventCategory" AS ENUM ('EXPLICIT_IMAGE', 'EXPLICIT_VIDEO', 'EXPLICIT_TEXT', 'SUGGESTIVE', 'BLOCKED_ATTEMPT', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "EventState" AS ENUM ('PENDING', 'DISCLOSED', 'LAPSED', 'CONTESTED');

-- CreateEnum
CREATE TYPE "AntecedentKind" AS ENUM ('LATE_HOUR', 'LONG_IDLE_UNLOCK', 'RAPID_APP_SWITCH', 'OFF_CHARGER_OVERNIGHT');

-- CreateEnum
CREATE TYPE "SilenceSeverity" AS ENUM ('WARNING', 'ALERT');

-- CreateEnum
CREATE TYPE "AckKind" AS ENUM ('SEEN', 'STILL_HERE');

-- CreateEnum
CREATE TYPE "NotificationKind" AS ENUM ('EVENT_PENDING', 'EVENT_DISCLOSED', 'EVENT_CONTESTED', 'EVENT_LAPSED', 'ANTECEDENT_NUDGE', 'SILENCE_ALERT', 'COVENANT_INVITED', 'COVENANT_ACTIVATED', 'COVENANT_REVOKED', 'COVENANT_DECLINED', 'GRACE_WINDOW_CHANGED', 'ALLY_ACK', 'DIGEST_READY');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT,
    "emailVerified" TIMESTAMP(3),
    "image" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "Covenant" (
    "id" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "allyId" TEXT,
    "status" "CovenantStatus" NOT NULL DEFAULT 'PENDING',
    "graceWindowMinutes" INTEGER NOT NULL DEFAULT 30,
    "termsVersion" TEXT NOT NULL,
    "subjectSignedAt" TIMESTAMP(3),
    "allySignedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "activatedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "revokedBy" "ActorRole",
    "inviteToken" TEXT NOT NULL,
    "inviteEmail" TEXT,
    "inviteExpiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Covenant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Device" (
    "id" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "covenantId" TEXT NOT NULL,
    "platform" "DevicePlatform" NOT NULL,
    "label" TEXT NOT NULL,
    "publicKey" TEXT NOT NULL,
    "sentinelVersion" TEXT NOT NULL,
    "classifierVersion" TEXT NOT NULL,
    "registeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastHeartbeatAt" TIMESTAMP(3),
    "status" "DeviceStatus" NOT NULL DEFAULT 'ACTIVE',
    "retiredAt" TIMESTAMP(3),

    CONSTRAINT "Device_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PairingCode" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "covenantId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "usedByDeviceId" TEXT,

    CONSTRAINT "PairingCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Event" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "covenantId" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "category" "EventCategory" NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "classifierVersion" TEXT NOT NULL,
    "state" "EventState" NOT NULL DEFAULT 'PENDING',
    "windowExpiresAt" TIMESTAMP(3) NOT NULL,
    "resolvedAt" TIMESTAMP(3),
    "disclosureNote" VARCHAR(500),
    "nonce" TEXT NOT NULL,
    "signature" TEXT NOT NULL,

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Antecedent" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "kind" "AntecedentKind" NOT NULL,
    "nonce" TEXT NOT NULL,
    "signature" TEXT NOT NULL,

    CONSTRAINT "Antecedent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Silence" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3),
    "severity" "SilenceSeverity" NOT NULL,
    "allyNotifiedAt" TIMESTAMP(3),

    CONSTRAINT "Silence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Digest" (
    "id" TEXT NOT NULL,
    "covenantId" TEXT NOT NULL,
    "weekStart" TIMESTAMP(3) NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "questionText" TEXT NOT NULL,
    "summaryText" TEXT NOT NULL,
    "readAt" TIMESTAMP(3),

    CONSTRAINT "Digest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AllyAck" (
    "id" TEXT NOT NULL,
    "digestId" TEXT,
    "eventId" TEXT,
    "allyId" TEXT NOT NULL,
    "kind" "AckKind" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AllyAck_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" "NotificationKind" NOT NULL,
    "body" TEXT NOT NULL,
    "eventId" TEXT,
    "covenantId" TEXT,
    "digestId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "readAt" TIMESTAMP(3),
    "emailedAt" TIMESTAMP(3),

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SeenNonce" (
    "nonce" TEXT NOT NULL,
    "deviceId" TEXT,
    "seenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SeenNonce_pkey" PRIMARY KEY ("nonce")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "VerificationToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");

-- CreateIndex
CREATE UNIQUE INDEX "Covenant_inviteToken_key" ON "Covenant"("inviteToken");

-- CreateIndex
CREATE INDEX "Covenant_subjectId_idx" ON "Covenant"("subjectId");

-- CreateIndex
CREATE INDEX "Covenant_allyId_idx" ON "Covenant"("allyId");

-- CreateIndex
CREATE INDEX "Covenant_status_idx" ON "Covenant"("status");

-- CreateIndex
CREATE INDEX "Device_subjectId_idx" ON "Device"("subjectId");

-- CreateIndex
CREATE INDEX "Device_covenantId_idx" ON "Device"("covenantId");

-- CreateIndex
CREATE INDEX "Device_status_idx" ON "Device"("status");

-- CreateIndex
CREATE INDEX "Device_lastHeartbeatAt_idx" ON "Device"("lastHeartbeatAt");

-- CreateIndex
CREATE UNIQUE INDEX "PairingCode_code_key" ON "PairingCode"("code");

-- CreateIndex
CREATE INDEX "PairingCode_covenantId_idx" ON "PairingCode"("covenantId");

-- CreateIndex
CREATE UNIQUE INDEX "Event_nonce_key" ON "Event"("nonce");

-- CreateIndex
CREATE INDEX "Event_covenantId_state_idx" ON "Event"("covenantId", "state");

-- CreateIndex
CREATE INDEX "Event_covenantId_occurredAt_idx" ON "Event"("covenantId", "occurredAt");

-- CreateIndex
CREATE INDEX "Event_state_windowExpiresAt_idx" ON "Event"("state", "windowExpiresAt");

-- CreateIndex
CREATE INDEX "Event_deviceId_idx" ON "Event"("deviceId");

-- CreateIndex
CREATE UNIQUE INDEX "Antecedent_nonce_key" ON "Antecedent"("nonce");

-- CreateIndex
CREATE INDEX "Antecedent_deviceId_occurredAt_idx" ON "Antecedent"("deviceId", "occurredAt");

-- CreateIndex
CREATE INDEX "Silence_deviceId_startedAt_idx" ON "Silence"("deviceId", "startedAt");

-- CreateIndex
CREATE INDEX "Silence_endedAt_idx" ON "Silence"("endedAt");

-- CreateIndex
CREATE INDEX "Digest_covenantId_weekStart_idx" ON "Digest"("covenantId", "weekStart");

-- CreateIndex
CREATE UNIQUE INDEX "Digest_covenantId_weekStart_key" ON "Digest"("covenantId", "weekStart");

-- CreateIndex
CREATE INDEX "AllyAck_allyId_idx" ON "AllyAck"("allyId");

-- CreateIndex
CREATE INDEX "AllyAck_digestId_idx" ON "AllyAck"("digestId");

-- CreateIndex
CREATE INDEX "AllyAck_eventId_idx" ON "AllyAck"("eventId");

-- CreateIndex
CREATE INDEX "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_userId_readAt_idx" ON "Notification"("userId", "readAt");

-- CreateIndex
CREATE INDEX "SeenNonce_seenAt_idx" ON "SeenNonce"("seenAt");

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Covenant" ADD CONSTRAINT "Covenant_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Covenant" ADD CONSTRAINT "Covenant_allyId_fkey" FOREIGN KEY ("allyId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Device" ADD CONSTRAINT "Device_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Device" ADD CONSTRAINT "Device_covenantId_fkey" FOREIGN KEY ("covenantId") REFERENCES "Covenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PairingCode" ADD CONSTRAINT "PairingCode_covenantId_fkey" FOREIGN KEY ("covenantId") REFERENCES "Covenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_covenantId_fkey" FOREIGN KEY ("covenantId") REFERENCES "Covenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Antecedent" ADD CONSTRAINT "Antecedent_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Silence" ADD CONSTRAINT "Silence_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Digest" ADD CONSTRAINT "Digest_covenantId_fkey" FOREIGN KEY ("covenantId") REFERENCES "Covenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AllyAck" ADD CONSTRAINT "AllyAck_digestId_fkey" FOREIGN KEY ("digestId") REFERENCES "Digest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AllyAck" ADD CONSTRAINT "AllyAck_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AllyAck" ADD CONSTRAINT "AllyAck_allyId_fkey" FOREIGN KEY ("allyId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_covenantId_fkey" FOREIGN KEY ("covenantId") REFERENCES "Covenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_digestId_fkey" FOREIGN KEY ("digestId") REFERENCES "Digest"("id") ON DELETE SET NULL ON UPDATE CASCADE;


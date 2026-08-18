-- Records when an invitation was actually handed to a mail transport.
-- Null means it was never delivered; the subject is told so rather than left
-- assuming it arrived.
ALTER TABLE "Covenant" ADD COLUMN "inviteSentAt" TIMESTAMP(3);

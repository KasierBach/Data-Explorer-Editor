-- AI processing is opt-in per account; legacy browser flags are not consent.
ALTER TABLE "User" ADD COLUMN "aiEnabled" BOOLEAN NOT NULL DEFAULT false;

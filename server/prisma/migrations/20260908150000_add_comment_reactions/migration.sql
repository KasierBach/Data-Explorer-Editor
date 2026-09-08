-- Emoji reactions on team comments. Comments live in the audit log, but
-- reactions are mutable (toggle on/off), so they need their own table.
CREATE TABLE "CommentReaction" (
    "id" TEXT NOT NULL,
    "commentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "emoji" VARCHAR(32) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommentReaction_pkey" PRIMARY KEY ("id")
);

-- Create index
CREATE INDEX "CommentReaction_commentId_idx" ON "CommentReaction"("commentId");

-- Add foreign key
ALTER TABLE "CommentReaction" ADD CONSTRAINT "CommentReaction_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Add unique constraint
ALTER TABLE "CommentReaction" ADD CONSTRAINT "CommentReaction_commentId_userId_emoji_key"
    UNIQUE ("commentId", "userId", "emoji");

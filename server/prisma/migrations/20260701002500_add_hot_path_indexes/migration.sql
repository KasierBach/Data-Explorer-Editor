CREATE INDEX "Connection_userId_createdAt_idx"
ON "Connection"("userId", "createdAt");

CREATE INDEX "AiChat_userId_updatedAt_idx"
ON "AiChat"("userId", "updatedAt");

CREATE INDEX "AiMessage_chatId_createdAt_idx"
ON "AiMessage"("chatId", "createdAt");

CREATE INDEX "AuditLog_createdAt_idx"
ON "AuditLog"("createdAt");

CREATE INDEX "AuditLog_userId_action_createdAt_idx"
ON "AuditLog"("userId", "action", "createdAt");

CREATE INDEX "AuditLog_organizationId_createdAt_idx"
ON "AuditLog"("organizationId", "createdAt");

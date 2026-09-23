-- DropIndex
DROP INDEX "ChatConversation_visitorId_key";

-- CreateIndex
CREATE INDEX "ChatConversation_visitorId_idx" ON "ChatConversation"("visitorId");

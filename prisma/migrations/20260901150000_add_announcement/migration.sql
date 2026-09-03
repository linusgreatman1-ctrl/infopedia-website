-- CreateTable
CREATE TABLE "Announcement" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'news',
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Announcement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Announcement_active_idx" ON "Announcement"("active");

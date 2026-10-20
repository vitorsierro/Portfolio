CREATE TABLE "SavedThread" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "authorName" TEXT NOT NULL DEFAULT '',
    "authorHandle" TEXT NOT NULL DEFAULT '',
    "postsJson" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SavedThread_userId_fkey" FOREIGN KEY ("userId") REFERENCES "Admin" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "SavedThread_userId_updatedAt_idx" ON "SavedThread"("userId", "updatedAt");

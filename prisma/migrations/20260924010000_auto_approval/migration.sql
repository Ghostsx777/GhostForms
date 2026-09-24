CREATE TABLE "AppSettings" (
  "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'global',
  "autoApproveAccounts" BOOLEAN NOT NULL DEFAULT false
);
INSERT INTO "AppSettings" ("id", "autoApproveAccounts") VALUES ('global', false);

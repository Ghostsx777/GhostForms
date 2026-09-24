CREATE TABLE "AppSettings" (
  "id" TEXT NOT NULL DEFAULT 'global',
  "autoApproveAccounts" BOOLEAN NOT NULL DEFAULT false,
  CONSTRAINT "AppSettings_pkey" PRIMARY KEY ("id")
);
INSERT INTO "AppSettings" ("id", "autoApproveAccounts") VALUES ('global', false);

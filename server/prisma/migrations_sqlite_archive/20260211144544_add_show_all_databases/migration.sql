-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Connection" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "host" TEXT NOT NULL,
    "port" INTEGER NOT NULL,
    "username" TEXT NOT NULL,
    "password" TEXT,
    "database" TEXT NOT NULL,
    "showAllDatabases" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_Connection" ("createdAt", "database", "host", "id", "name", "password", "port", "type", "username") SELECT "createdAt", "database", "host", "id", "name", "password", "port", "type", "username" FROM "Connection";
DROP TABLE "Connection";
ALTER TABLE "new_Connection" RENAME TO "Connection";
CREATE UNIQUE INDEX "Connection_name_key" ON "Connection"("name");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

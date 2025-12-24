-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Room" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ownerId" TEXT NOT NULL,
    "controllerId" TEXT,
    "media" TEXT,
    "playlist" TEXT,
    "quarkCookie" TEXT,
    "title" TEXT,
    "description" TEXT,
    "isLocked" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Room" ("controllerId", "createdAt", "description", "id", "media", "ownerId", "playlist", "quarkCookie", "title", "updatedAt") SELECT "controllerId", "createdAt", "description", "id", "media", "ownerId", "playlist", "quarkCookie", "title", "updatedAt" FROM "Room";
DROP TABLE "Room";
ALTER TABLE "new_Room" RENAME TO "Room";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

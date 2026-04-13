-- CreateTable
CREATE TABLE "Account" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "activated" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resetToken" TEXT,
    "resetTokenExpiry" DATETIME,
    "resetTokenUsed" BOOLEAN NOT NULL DEFAULT false
);

-- CreateTable
CREATE TABLE "RegularUser" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "phone_number" TEXT NOT NULL DEFAULT '',
    "postal_address" TEXT NOT NULL DEFAULT '',
    "birthday" TEXT NOT NULL DEFAULT '1970-01-01',
    "suspended" BOOLEAN NOT NULL DEFAULT false,
    "available" BOOLEAN NOT NULL DEFAULT false,
    "lastActiveAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "avatar" TEXT,
    "resume" TEXT,
    "biography" TEXT,
    CONSTRAINT "RegularUser_id_fkey" FOREIGN KEY ("id") REFERENCES "Account" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Business" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "business_name" TEXT NOT NULL,
    "owner_name" TEXT NOT NULL,
    "phone_number" TEXT NOT NULL,
    "postal_address" TEXT NOT NULL,
    "lon" REAL NOT NULL,
    "lat" REAL NOT NULL,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "avatar" TEXT,
    "biography" TEXT,
    CONSTRAINT "Business_id_fkey" FOREIGN KEY ("id") REFERENCES "Account" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Admin" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "utorid" TEXT NOT NULL,
    CONSTRAINT "Admin_id_fkey" FOREIGN KEY ("id") REFERENCES "Account" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PositionType" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "hidden" BOOLEAN NOT NULL DEFAULT true
);

-- CreateTable
CREATE TABLE "Qualification" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "status" TEXT NOT NULL DEFAULT 'created',
    "note" TEXT NOT NULL DEFAULT '',
    "document" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "userId" INTEGER NOT NULL,
    "positionTypeId" INTEGER NOT NULL,
    CONSTRAINT "Qualification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "RegularUser" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Qualification_positionTypeId_fkey" FOREIGN KEY ("positionTypeId") REFERENCES "PositionType" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Job" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "status" TEXT NOT NULL DEFAULT 'open',
    "positionTypeId" INTEGER NOT NULL,
    "businessId" INTEGER NOT NULL,
    "workerId" INTEGER,
    "salary_min" REAL NOT NULL,
    "salary_max" REAL NOT NULL,
    "start_time" DATETIME NOT NULL,
    "end_time" DATETIME NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Job_positionTypeId_fkey" FOREIGN KEY ("positionTypeId") REFERENCES "PositionType" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Job_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Job_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "RegularUser" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Interest" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "jobId" INTEGER NOT NULL,
    "candidateId" INTEGER NOT NULL,
    "candidateInterested" BOOLEAN,
    "businessInterested" BOOLEAN,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Interest_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Interest_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "RegularUser" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Negotiation" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "interestId" INTEGER NOT NULL,
    "jobId" INTEGER NOT NULL,
    "candidateId" INTEGER NOT NULL,
    "businessId" INTEGER NOT NULL,
    "candidateDecision" TEXT,
    "businessDecision" TEXT,
    "expiresAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Negotiation_interestId_fkey" FOREIGN KEY ("interestId") REFERENCES "Interest" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Negotiation_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Account_email_key" ON "Account"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Account_resetToken_key" ON "Account"("resetToken");

-- CreateIndex
CREATE UNIQUE INDEX "Admin_utorid_key" ON "Admin"("utorid");

-- CreateIndex
CREATE UNIQUE INDEX "Qualification_userId_positionTypeId_key" ON "Qualification"("userId", "positionTypeId");

-- CreateIndex
CREATE UNIQUE INDEX "Interest_jobId_candidateId_key" ON "Interest"("jobId", "candidateId");

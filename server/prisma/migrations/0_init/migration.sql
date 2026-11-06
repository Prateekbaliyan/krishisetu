-- CreateTable User
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL UNIQUE,
    "passwordHash" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "centreId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL
);

-- CreateTable CollectionCentre
CREATE TABLE "CollectionCentre" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL UNIQUE,
    "name" TEXT NOT NULL,
    "village" TEXT NOT NULL,
    "taluka" TEXT NOT NULL,
    "district" TEXT NOT NULL DEFAULT 'Latur',
    "operatorName" TEXT NOT NULL,
    "contactNumber" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL
);

-- CreateTable Farmer
CREATE TABLE "Farmer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "farmerId" TEXT NOT NULL UNIQUE,
    "fullName" TEXT NOT NULL,
    "village" TEXT NOT NULL,
    "centreId" TEXT NOT NULL,
    "landAreaAcres" DECIMAL(5,2) NOT NULL,
    "primaryCrop" TEXT NOT NULL,
    "bankAccountName" TEXT NOT NULL,
    "bankAccountNumber" TEXT NOT NULL,
    "ifscCode" TEXT NOT NULL,
    "bankName" TEXT NOT NULL,
    "bankVerificationStatus" TEXT NOT NULL DEFAULT 'VERIFIED',
    "mobileNumber" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL
);

-- CreateTable PriceBoard
CREATE TABLE "PriceBoard" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "crop" TEXT NOT NULL,
    "grade" TEXT NOT NULL,
    "ratePerQuintal" DECIMAL(10,2) NOT NULL,
    "effectiveDate" TEXT NOT NULL,
    "publishedBy" TEXT NOT NULL,
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isActive" BOOLEAN NOT NULL DEFAULT true
);

-- CreateTable PriceHistory
CREATE TABLE "PriceHistory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "crop" TEXT NOT NULL,
    "grade" TEXT NOT NULL,
    "ratePerQuintal" DECIMAL(10,2) NOT NULL,
    "effectiveDate" TEXT NOT NULL,
    "changedBy" TEXT NOT NULL,
    "changeReason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable Purchase
CREATE TABLE "Purchase" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slipNumber" TEXT NOT NULL UNIQUE,
    "idempotencyKey" TEXT NOT NULL UNIQUE,
    "farmerId" TEXT NOT NULL,
    "centreId" TEXT NOT NULL,
    "crop" TEXT NOT NULL,
    "grade" TEXT NOT NULL,
    "grossWeight" DECIMAL(10,1) NOT NULL,
    "tareWeight" DECIMAL(10,1) NOT NULL,
    "actualWeight" DECIMAL(10,1) NOT NULL,
    "moisture" DECIMAL(4,1) NOT NULL,
    "moistureDeductionPercent" DECIMAL(5,2) NOT NULL,
    "netWeight" DECIMAL(10,1) NOT NULL,
    "ratePerQuintal" DECIMAL(10,2) NOT NULL,
    "totalAmount" DECIMAL(12,2) NOT NULL,
    "purchaseDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'PENDING_APPROVAL',
    "scalePhotoUrl" TEXT,
    "moisturePhotoUrl" TEXT,
    "scaleAiWeight" DECIMAL(10,1),
    "moistureAiValue" DECIMAL(4,1),
    "aiConfidence" DECIMAL(5,2),
    "aiVerificationStatus" TEXT NOT NULL DEFAULT 'NOT_PERFORMED',
    "aiDiffNotes" TEXT,
    "clientDeviceTimestamp" TIMESTAMP(3),
    "localCreationTimestamp" TIMESTAMP(3),
    "serverReceivedTimestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "syncStatus" TEXT NOT NULL DEFAULT 'SYNCED',
    "paymentEligibility" BOOLEAN NOT NULL DEFAULT true,
    "paymentRunId" TEXT,
    "isFlagged" BOOLEAN NOT NULL DEFAULT false,
    "flagReason" TEXT,
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL
);

-- CreateTable AnomalyFlag
CREATE TABLE "AnomalyFlag" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "purchaseId" TEXT NOT NULL,
    "flagType" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "details" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "reviewedBy" TEXT,
    "reviewNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable PaymentRun
CREATE TABLE "PaymentRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "batchNumber" TEXT NOT NULL UNIQUE,
    "totalFarmers" INTEGER NOT NULL,
    "totalPurchases" INTEGER NOT NULL,
    "totalAmount" DECIMAL(14,2) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "csvFileName" TEXT,
    "csvContent" TEXT,
    "createdBy" TEXT NOT NULL,
    "approvedBy" TEXT,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL
);

-- CreateTable Payment
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "paymentRunId" TEXT NOT NULL,
    "farmerId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "bankAccountName" TEXT NOT NULL,
    "bankAccountNumber" TEXT NOT NULL,
    "ifscCode" TEXT NOT NULL,
    "bankReferenceNumber" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "failureReason" TEXT,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL
);

-- CreateTable Dispatch
CREATE TABLE "Dispatch" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "centreId" TEXT NOT NULL,
    "crop" TEXT NOT NULL,
    "truckNumber" TEXT NOT NULL,
    "driverName" TEXT NOT NULL,
    "driverMobile" TEXT,
    "dispatchWeight" DECIMAL(10,1) NOT NULL,
    "destination" TEXT NOT NULL,
    "weightLossKg" DECIMAL(8,1) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "dispatchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable AuditLog
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "userId" TEXT,
    "userName" TEXT,
    "previousHash" TEXT,
    "eventHash" TEXT NOT NULL,
    "details" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable SyncRecord
CREATE TABLE "SyncRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "idempotencyKey" TEXT NOT NULL UNIQUE,
    "clientId" TEXT NOT NULL,
    "centreId" TEXT NOT NULL,
    "purchaseSlip" TEXT,
    "status" TEXT NOT NULL,
    "errorMessage" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable SmsLog
CREATE TABLE "SmsLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "purchaseId" TEXT NOT NULL,
    "farmerMobile" TEXT NOT NULL,
    "farmerName" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DELIVERED',
    "providerResponse" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- AddForeignKeys
ALTER TABLE "User" ADD CONSTRAINT "User_centreId_fkey" FOREIGN KEY ("centreId") REFERENCES "CollectionCentre"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Farmer" ADD CONSTRAINT "Farmer_centreId_fkey" FOREIGN KEY ("centreId") REFERENCES "CollectionCentre"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Purchase" ADD CONSTRAINT "Purchase_farmerId_fkey" FOREIGN KEY ("farmerId") REFERENCES "Farmer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Purchase" ADD CONSTRAINT "Purchase_centreId_fkey" FOREIGN KEY ("centreId") REFERENCES "CollectionCentre"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Purchase" ADD CONSTRAINT "Purchase_paymentRunId_fkey" FOREIGN KEY ("paymentRunId") REFERENCES "PaymentRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AnomalyFlag" ADD CONSTRAINT "AnomalyFlag_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "Purchase"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_paymentRunId_fkey" FOREIGN KEY ("paymentRunId") REFERENCES "PaymentRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_farmerId_fkey" FOREIGN KEY ("farmerId") REFERENCES "Farmer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Dispatch" ADD CONSTRAINT "Dispatch_centreId_fkey" FOREIGN KEY ("centreId") REFERENCES "CollectionCentre"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SmsLog" ADD CONSTRAINT "SmsLog_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "Purchase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


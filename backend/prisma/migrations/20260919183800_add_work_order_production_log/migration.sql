-- CreateEnum
CREATE TYPE "WorkOrderType" AS ENUM ('HARIAN', 'BULANAN');

-- CreateEnum
CREATE TYPE "ApprovalStatus" AS ENUM ('DRAFT', 'APPROVED');

-- CreateEnum
CREATE TYPE "ProductionResult" AS ENUM ('OK', 'NG', 'REJECT');

-- CreateEnum
CREATE TYPE "DowntimeCategory" AS ENUM ('BREAKDOWN', 'SETUP', 'MATERIAL', 'MAINTENANCE', 'QUALITY', 'OTHER');

-- CreateTable
CREATE TABLE "work_orders" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "type" "WorkOrderType" NOT NULL DEFAULT 'HARIAN',
    "approvalStatus" "ApprovalStatus" NOT NULL DEFAULT 'DRAFT',
    "description" TEXT,
    "targetQuantity" INTEGER,
    "scheduledDate" TIMESTAMPTZ(3),
    "dueDate" TIMESTAMPTZ(3),
    "shiftId" INTEGER NOT NULL,
    "machineId" INTEGER NOT NULL,
    "itemId" INTEGER NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "work_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "production_logs" (
    "id" SERIAL NOT NULL,
    "workOrderId" INTEGER NOT NULL,
    "loggedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cycleTimeSeconds" INTEGER,
    "result" "ProductionResult" NOT NULL DEFAULT 'OK',
    "goodQty" INTEGER,
    "ngQty" INTEGER,
    "downtimeCategory" "DowntimeCategory",
    "downtimeMinutes" INTEGER,
    "note" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "production_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "work_orders_code_key" ON "work_orders"("code");

-- CreateIndex
CREATE INDEX "work_orders_shiftId_idx" ON "work_orders"("shiftId");

-- CreateIndex
CREATE INDEX "work_orders_machineId_idx" ON "work_orders"("machineId");

-- CreateIndex
CREATE INDEX "work_orders_itemId_idx" ON "work_orders"("itemId");

-- CreateIndex
CREATE INDEX "work_orders_type_idx" ON "work_orders"("type");

-- CreateIndex
CREATE INDEX "work_orders_approvalStatus_idx" ON "work_orders"("approvalStatus");

-- CreateIndex
CREATE INDEX "production_logs_workOrderId_idx" ON "production_logs"("workOrderId");

-- CreateIndex
CREATE INDEX "production_logs_downtimeCategory_idx" ON "production_logs"("downtimeCategory");

-- AddForeignKey
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "shifts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_machineId_fkey" FOREIGN KEY ("machineId") REFERENCES "machines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_logs" ADD CONSTRAINT "production_logs_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "work_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

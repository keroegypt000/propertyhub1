-- الترقيم التسلسلي للمستندات: سندات القبض (ق) والصرف (ص) والعقود (ع) وفواتير الإيجار (ف)
-- عدّاد مركزي يتزايد ذريًا + أعمدة الأرقام على الجداول المعنية

-- CreateTable
CREATE TABLE "DocCounter" (
    "key" TEXT NOT NULL,
    "current" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "DocCounter_pkey" PRIMARY KEY ("key")
);

-- AlterTable
ALTER TABLE "Contract" ADD COLUMN "number" TEXT;
ALTER TABLE "Payment" ADD COLUMN "invoiceNo" TEXT;
ALTER TABLE "Payment" ADD COLUMN "receiptNo" TEXT;
ALTER TABLE "Transaction" ADD COLUMN "voucherNo" TEXT;
ALTER TABLE "Loan" ADD COLUMN "receiptNo" TEXT;
ALTER TABLE "LoanPayment" ADD COLUMN "paymentNo" TEXT;
ALTER TABLE "MaintenanceRequest" ADD COLUMN "paymentNo" TEXT;
ALTER TABLE "SupplierPayment" ADD COLUMN "paymentNo" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Contract_number_key" ON "Contract"("number");
CREATE UNIQUE INDEX "Payment_invoiceNo_key" ON "Payment"("invoiceNo");
CREATE UNIQUE INDEX "Payment_receiptNo_key" ON "Payment"("receiptNo");
CREATE UNIQUE INDEX "Transaction_voucherNo_key" ON "Transaction"("voucherNo");
CREATE UNIQUE INDEX "Loan_receiptNo_key" ON "Loan"("receiptNo");
CREATE UNIQUE INDEX "LoanPayment_paymentNo_key" ON "LoanPayment"("paymentNo");
CREATE UNIQUE INDEX "MaintenanceRequest_paymentNo_key" ON "MaintenanceRequest"("paymentNo");
CREATE UNIQUE INDEX "SupplierPayment_paymentNo_key" ON "SupplierPayment"("paymentNo");

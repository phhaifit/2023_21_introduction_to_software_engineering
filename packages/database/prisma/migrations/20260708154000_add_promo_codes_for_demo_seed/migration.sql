CREATE TABLE "promo_codes" (
    "promoCodeId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "discountAmount" DOUBLE PRECISION NOT NULL,
    "validFrom" TEXT NOT NULL,
    "validUntil" TEXT NOT NULL,
    "maxUsages" INTEGER NOT NULL DEFAULT 0,
    "currentUsages" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TEXT NOT NULL,
    "updatedAt" TEXT NOT NULL,

    CONSTRAINT "promo_codes_pkey" PRIMARY KEY ("promoCodeId")
);

CREATE UNIQUE INDEX "promo_codes_code_key" ON "promo_codes"("code");
CREATE INDEX "promo_codes_code_idx" ON "promo_codes"("code");
CREATE INDEX "promo_codes_status_idx" ON "promo_codes"("status");

import type { EntityId } from "@vcp/shared/contracts/ids.ts";

export type PromoCodeStatus = "active" | "expired" | "disabled";

export type PromoCode = {
  promoCodeId: EntityId<"promoCodeId">;
  code: string;
  discountAmount: number;
  validFrom: string;
  validUntil: string;
  maxUsages: number;
  currentUsages: number;
  status: PromoCodeStatus;
  createdAt: string;
  updatedAt: string;
};

export function isPromoCodeValid(promo: PromoCode, nowStr: string): boolean {
  if (promo.status !== "active") return false;
  const now = new Date(nowStr);
  if (now < new Date(promo.validFrom)) return false;
  if (now > new Date(promo.validUntil)) return false;
  if (promo.maxUsages > 0 && promo.currentUsages >= promo.maxUsages) return false;
  return true;
}

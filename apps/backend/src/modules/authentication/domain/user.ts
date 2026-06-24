import type { EntityId } from "@vcp/shared/contracts/ids.ts";

export const USER_STATUSES = ["active", "disabled"] as const;

export type UserStatus = (typeof USER_STATUSES)[number];

export type User = {
  userId: EntityId<"userId">;
  email: string;
  displayName?: string;
  passwordHash: string;
  status: UserStatus;
  createdAt: string;
  updatedAt: string;
};

export type UserDraft = {
  userId: EntityId<"userId">;
  email: string;
  displayName?: string;
  passwordHash: string;
  status?: UserStatus;
  createdAt: string;
  updatedAt: string;
};

export function createUser(draft: UserDraft): User {
  return {
    ...draft,
    status: draft.status ?? "active"
  };
}

export function normalizeUserEmail(email: string): string {
  return email.trim().toLowerCase();
}

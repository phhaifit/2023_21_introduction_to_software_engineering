import type { EntityId } from "@vcp/shared/contracts/ids.ts";
import type { UserStatus } from "./user.ts";

export type UserPublicProfile = {
  userId: EntityId<"userId">;
  email: string;
  displayName?: string;
  status: UserStatus;
  createdAt: string;
};

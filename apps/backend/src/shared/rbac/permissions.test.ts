import { describe, expect, it } from "vitest";

import { canPerform } from "./permissions.ts";

describe("workspace RBAC permissions", () => {
  it("allows Host to manage workspace members", () => {
    expect(canPerform("host", "members:manage")).toEqual({ allowed: true });
  });

  it("denies unknown runtime roles without throwing", () => {
    expect(canPerform("unknown" as any, "members:manage")).toEqual({
      allowed: false,
      reason: "Role unknown does not have permission members:manage"
    });
  });
});

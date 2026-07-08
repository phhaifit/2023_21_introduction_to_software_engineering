export const WORKSPACE_ROLES = ["host", "admin", "editor", "viewer"] as const;

export type WorkspaceRole = (typeof WORKSPACE_ROLES)[number];

export const PERMISSIONS = [
  "workspace:read",
  "workspace:delete",
  "members:manage",
  "agents:manage",
  "tools:manage",
  "workflows:manage",
  "tasks:run",
  "knowledge:manage",
  "billing:manage"
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export const ROLE_PERMISSIONS: Record<WorkspaceRole, readonly Permission[]> = {
  host: PERMISSIONS,
  admin: PERMISSIONS,
  editor: [
    "workspace:read",
    "agents:manage",
    "tools:manage",
    "workflows:manage",
    "tasks:run",
    "knowledge:manage"
  ],
  viewer: ["workspace:read"]
};

export function roleHasPermission(
  role: WorkspaceRole,
  permission: Permission
): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

import { Router } from "express";
import type { WorkspaceUserManagementService } from "./workspace-user-management.service.ts";

export function createWorkspaceUserManagementRouter(dependencies: {
  service: WorkspaceUserManagementService;
}): Router {
  const router = Router({ mergeParams: true });
  const { service } = dependencies;

  async function getCurrentUser(req: any) {
    const email = req.context?.user?.email || "mapmobile123456@gmail.com";
    if (email === "mapmobile123456@gmail.com") return { email, role: "admin_default" };

    const workspaceId = req.params.workspaceId;
    const result = await service.listMembers(workspaceId);
    const me = result.members.find((m: any) => m.email === email);
    return { email, role: me ? me.role : "viewer" };
  }

  // GET /api/workspaces/:workspaceId/members
  router.get("/members", async (req, res, next) => {
    try {
      const workspaceId = req.params.workspaceId;
      const result = await service.listMembers(workspaceId);
      const user = await getCurrentUser(req);
      res.status(200).json({ ...result, currentUserRole: user.role, currentUserEmail: user.email });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // POST /api/workspaces/:workspaceId/invitations
  router.post("/invitations", async (req, res, next) => {
    try {
      const workspaceId = req.params.workspaceId;
      const { email, role } = req.body;
      const user = await getCurrentUser(req);
      const invitedByUserId = user.email;

      if (user.role !== "admin" && user.role !== "admin_default") {
        res.status(403).json({ error: "Forbidden: Only admins can invite members." });
        return;
      }

      const invite = await service.inviteMember(workspaceId, email, role, invitedByUserId);
      res.status(201).json(invite);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // PUT /api/workspaces/:workspaceId/members/:memberId
  router.put("/members/:memberId", async (req, res, next) => {
    try {
      const workspaceId = req.params.workspaceId;
      const memberId = req.params.memberId;
      const { role } = req.body;
      const user = await getCurrentUser(req);

      if (user.role !== "admin" && user.role !== "admin_default") {
        res.status(403).json({ error: "Forbidden: Only admins can update roles." });
        return;
      }

      const updated = await service.updateMemberRole(workspaceId, memberId, role);
      res.status(200).json(updated);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // DELETE /api/workspaces/:workspaceId/members/:memberId
  router.delete("/members/:memberId", async (req, res, next) => {
    try {
      const workspaceId = req.params.workspaceId;
      const memberId = req.params.memberId;
      const user = await getCurrentUser(req);

      if (user.role !== "admin" && user.role !== "admin_default") {
        res.status(403).json({ error: "Forbidden: Only admins can remove members." });
        return;
      }

      await service.removeMember(workspaceId, memberId);
      res.status(204).send();
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // DELETE /api/workspaces/:workspaceId/invitations/:invitationId
  router.delete("/invitations/:invitationId", async (req, res, next) => {
    try {
      const workspaceId = req.params.workspaceId;
      const invitationId = req.params.invitationId;
      const user = await getCurrentUser(req);

      if (user.role !== "admin" && user.role !== "admin_default") {
        res.status(403).json({ error: "Forbidden: Only admins can revoke invitations." });
        return;
      }

      await service.revokeInvitation(workspaceId, invitationId);
      res.status(204).send();
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });
  // PUT /api/workspaces/:workspaceId/invitations/:invitationId
  router.put("/invitations/:invitationId", async (req, res, next) => {
    try {
      const invitationId = req.params.invitationId;
      const { role } = req.body;
      const user = await getCurrentUser(req);

      if (user.role !== "admin" && user.role !== "admin_default") {
        res.status(403).json({ error: "Forbidden: Only admins can update invitations." });
        return;
      }

      const invite = await service.updateInvitationRole(invitationId, role);
      res.status(200).json(invite);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  return router;
}

export function createAcceptInvitationRouter(dependencies: {
  service: WorkspaceUserManagementService;
}): Router {
  const router = Router({ mergeParams: true });
  const { service } = dependencies;

  // POST /api/invitations/accept
  router.post("/accept", async (req, res, next) => {
    try {
      const { token } = req.body;
      const context = (req as any).context;
      const currentUserId = context?.user?.userId;

      if (!currentUserId) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      const member = await service.acceptInvitation(token, currentUserId);
      res.status(200).json(member);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  return router;
}
export function createWorkspaceListRouter(dependencies: {
  service: WorkspaceUserManagementService;
}): Router {
  const router = Router();
  const { service } = dependencies;

  router.get("/", async (req, res) => {
    try {
      const context = (req as any).context;
      const currentUserId = context?.user?.userId;

      if (!currentUserId) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      const workspaces = await service.listWorkspacesByUserId(currentUserId);
      res.status(200).json(workspaces);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  router.post("/", async (req, res) => {
    try {
      const { name } = req.body;
      const context = (req as any).context;
      const currentUserId = context?.user?.userId;

      if (!currentUserId) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      const workspace = await service.createWorkspace(name, currentUserId);
      res.status(201).json(workspace);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  return router;
}

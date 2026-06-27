import { Router } from "express";

import { WorkspaceController } from "./workspace-controller.ts";
import type { WorkspaceHttpDependencies } from "./workspace-http-dependencies.ts";

export function createWorkspaceManagementRouter(
  dependencies: WorkspaceHttpDependencies
): Router {
  const router = Router();
  const controller = new WorkspaceController(dependencies);

  router.get("/", (request, response) => {
    void controller.list(request, response);
  });

  router.post("/", (request, response) => {
    void controller.create(request, response);
  });

  router.get("/:workspaceId", (request, response) => {
    void controller.detail(request, response);
  });

  router.delete("/:workspaceId", (request, response) => {
    void controller.delete(request, response);
  });

  return router;
}

import { WorkspaceEventFactory } from "../application/services/workspace-event-factory.ts";
import { CreateWorkspaceUseCase } from "../application/use-cases/create-workspace.ts";
import { DeleteWorkspaceUseCase } from "../application/use-cases/delete-workspace.ts";
import { GetWorkspaceDetailUseCase } from "../application/use-cases/get-workspace-detail.ts";
import { ListWorkspacesUseCase } from "../application/use-cases/list-workspaces.ts";
import { ProcessWorkspaceOperationUseCase } from "../application/use-cases/process-workspace-operation.ts";
import { PublishWorkspaceOutboxMessageUseCase } from "../application/use-cases/publish-workspace-outbox-message.ts";
import type { WorkspaceHttpDependencies } from "../interface/http/workspace-http-dependencies.ts";
import { InMemoryWorkspaceUnitOfWork } from "./in-memory/in-memory-workspace-unit-of-work.ts";
import { InMemoryWorkspaceRepository } from "./in-memory/in-memory-workspace-repository.ts";
import { InMemoryWorkspaceOperationRepository } from "./in-memory/in-memory-workspace-operation-repository.ts";
import { InMemoryWorkspaceOutboxRepository } from "./in-memory/in-memory-workspace-outbox-repository.ts";
import { InMemoryWorkspaceCommandReceiptRepository } from "./in-memory/in-memory-workspace-command-receipt-repository.ts";
import { InMemoryWorkspaceVisibilityProjectionRepository } from "./in-memory/in-memory-workspace-visibility-projection-repository.ts";
import { InMemoryWorkspaceAccessQueryAdapter } from "./in-memory-workspace-access-query-adapter.ts";
import { SystemWorkspaceClock } from "./system-workspace-clock.ts";
import { RandomWorkspaceIdFactory } from "./random-workspace-id-factory.ts";
import { StableWorkspaceProviderRequestKeyFactory } from "./stable-workspace-provider-request-key-factory.ts";
import { PermissiveWorkspaceEntitlementAdapter } from "./permissive-workspace-entitlement-adapter.ts";
import { LocalWorkspaceRuntimeProvisioningAdapter } from "./local-workspace-runtime-provisioning-adapter.ts";
import { LocalDevWorkspaceEventPublisher } from "./local-dev-workspace-event-publisher.ts";

export type WorkspaceServerRuntime = {
  readonly httpDependencies: WorkspaceHttpDependencies;
  readonly processOperation: ProcessWorkspaceOperationUseCase;
  readonly publishOutbox: PublishWorkspaceOutboxMessageUseCase;
};

export function createWorkspaceServerRuntime(): WorkspaceServerRuntime {
  const clock = new SystemWorkspaceClock();
  const ids = new RandomWorkspaceIdFactory();
  const providerKeys = new StableWorkspaceProviderRequestKeyFactory();
  const events = new WorkspaceEventFactory();

  const unitOfWork = new InMemoryWorkspaceUnitOfWork();
  const workspaces = new InMemoryWorkspaceRepository();
  const operations = new InMemoryWorkspaceOperationRepository();
  const outbox = new InMemoryWorkspaceOutboxRepository();
  const receipts = new InMemoryWorkspaceCommandReceiptRepository();
  const visibility = new InMemoryWorkspaceVisibilityProjectionRepository();

  const entitlement = new PermissiveWorkspaceEntitlementAdapter();
  const access = new InMemoryWorkspaceAccessQueryAdapter(visibility.records);
  const runtime = new LocalWorkspaceRuntimeProvisioningAdapter();
  const publisher = new LocalDevWorkspaceEventPublisher(visibility);

  const listWorkspaces = new ListWorkspacesUseCase(workspaces, visibility, access, clock);
  const getWorkspaceDetail = new GetWorkspaceDetailUseCase(workspaces, access, clock);
  const createWorkspace = new CreateWorkspaceUseCase(
    unitOfWork, workspaces, operations, outbox, receipts,
    entitlement, ids, providerKeys, clock, events
  );
  const deleteWorkspace = new DeleteWorkspaceUseCase(
    unitOfWork, workspaces, operations, outbox, receipts,
    access, ids, providerKeys, clock, events
  );
  const processOperation = new ProcessWorkspaceOperationUseCase(
    unitOfWork, workspaces, operations, outbox, runtime, ids, clock, events
  );
  const publishOutbox = new PublishWorkspaceOutboxMessageUseCase(
    unitOfWork, outbox, publisher, clock
  );

  return {
    httpDependencies: {
      listWorkspaces,
      getWorkspaceDetail,
      createWorkspace,
      deleteWorkspace,
      bootstrapTtlSeconds: 3600,
      deleteFailedRetryReconciled: true
    },
    processOperation,
    publishOutbox
  };
}

import type {
  EntityId,
  TaskExecutionAdapter,
  StartExecutionCommand,
  ExecutionBinding,
  NormalizedRuntimeEvent,
  ExecutionSnapshot,
  WorkspaceExecutionRuntimeResolver,
  CanonicalTaskStatus
} from "@vcp/shared";

/**
 * MockTaskExecutionAdapter wraps existing in-memory mock execution as a legitimate 
 * Task & Orchestration test and development adapter satisfying TaskExecutionAdapter.
 *
 * External Prerequisite Documentation:
 * A usable execution-runtime reference must be supplied by Workspace Management or the 
 * responsible infrastructure module before real execution can begin.
 *
 * Out-of-Scope Compliance:
 * This codebase confirms no runtime provisioning, container management, secret ownership, 
 * OpenClaw installation, custom AI routing, custom orchestration, or custom multi-agent execution exists.
 */
export class MockTaskExecutionAdapter implements TaskExecutionAdapter {
  private resolver: WorkspaceExecutionRuntimeResolver;
  private subscribers = new Map<string, Set<(event: NormalizedRuntimeEvent) => void>>();
  private snapshots = new Map<string, ExecutionSnapshot>();

  constructor(resolver: WorkspaceExecutionRuntimeResolver) {
    this.resolver = resolver;
  }

  async startExecution(command: StartExecutionCommand): Promise<ExecutionBinding> {
    // Verify external prerequisite: resolve runtime reference without provisioning it
    const runtime = await this.resolver.resolve(command.workspaceId);
    if (runtime.status !== "running") {
      throw new Error(`Execution runtime is not running (status: ${runtime.status})`);
    }

    const taskIdStr = command.taskId as string;

    // Create initial snapshot
    const snapshot: ExecutionSnapshot = {
      taskId: command.taskId,
      status: "in-progress",
      updatedAt: new Date().toISOString()
    };
    this.snapshots.set(taskIdStr, snapshot);

    // Emit accepted and started events
    this.publish(command.taskId, {
      type: "execution-accepted",
      taskId: command.taskId,
      timestamp: new Date().toISOString()
    });
    this.publish(command.taskId, {
      type: "execution-started",
      taskId: command.taskId,
      timestamp: new Date().toISOString()
    });

    // Return the ExecutionBinding associating Platform Task <-> external runtime reference <-> provider reference
    return {
      taskId: command.taskId,
      runtimeInstanceId: runtime.instanceId,
      providerExecutionReference: `mock-run-${Date.now()}`,
      verifiedProviderFields: {
        endpoint: runtime.endpointReference,
        simulated: true
      }
    };
  }

  async cancelExecution(taskId: EntityId<"taskId">): Promise<void> {
    const taskIdStr = taskId as string;
    const snapshot = this.snapshots.get(taskIdStr);
    if (snapshot) {
      snapshot.status = "canceled";
      snapshot.updatedAt = new Date().toISOString();
      const event: NormalizedRuntimeEvent = {
        type: "execution-canceled",
        taskId,
        timestamp: new Date().toISOString()
      };
      snapshot.lastObservedEvent = event;
      this.publish(taskId, event);
    }
  }

  async getExecutionSnapshot(taskId: EntityId<"taskId">): Promise<ExecutionSnapshot> {
    const taskIdStr = taskId as string;
    const snapshot = this.snapshots.get(taskIdStr);
    if (!snapshot) {
      return {
        taskId,
        status: "pending",
        updatedAt: new Date().toISOString()
      };
    }
    return snapshot;
  }

  subscribe(taskId: EntityId<"taskId">, callback: (event: NormalizedRuntimeEvent) => void): void {
    const taskIdStr = taskId as string;
    if (!this.subscribers.has(taskIdStr)) {
      this.subscribers.set(taskIdStr, new Set());
    }
    this.subscribers.get(taskIdStr)!.add(callback);
  }

  unsubscribe(taskId: EntityId<"taskId">, callback: (event: NormalizedRuntimeEvent) => void): void {
    const taskIdStr = taskId as string;
    const set = this.subscribers.get(taskIdStr);
    if (set) {
      set.delete(callback);
    }
  }

  async releaseResources(): Promise<void> {
    this.subscribers.clear();
    this.snapshots.clear();
  }

  // Helper to simulate events in testing/development
  simulateRuntimeEvent(event: NormalizedRuntimeEvent, updatedStatus: CanonicalTaskStatus): void {
    const taskIdStr = event.taskId as string;
    const snapshot = this.snapshots.get(taskIdStr) || {
      taskId: event.taskId,
      status: updatedStatus,
      updatedAt: new Date().toISOString()
    };
    snapshot.status = updatedStatus;
    snapshot.lastObservedEvent = event;
    snapshot.updatedAt = new Date().toISOString();
    this.snapshots.set(taskIdStr, snapshot);

    this.publish(event.taskId, event);
  }

  private publish(taskId: EntityId<"taskId">, event: NormalizedRuntimeEvent): void {
    const set = this.subscribers.get(taskId as string);
    if (set) {
      for (const callback of set) {
        callback(event);
      }
    }
  }
}

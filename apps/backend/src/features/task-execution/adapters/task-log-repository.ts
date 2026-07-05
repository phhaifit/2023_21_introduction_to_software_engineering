export interface TaskLogRepository {
  saveTaskLog(taskId: string, events: any[]): Promise<void>;
  readTaskLog(taskId: string): Promise<any[] | null>;
}

export class NoOpTaskLogRepository implements TaskLogRepository {
  async saveTaskLog(): Promise<void> {}
  async readTaskLog(): Promise<any[] | null> {
    return null;
  }
}

export class InMemoryTaskLogRepository implements TaskLogRepository {
  private readonly eventsByTaskId = new Map<string, any[]>();

  async saveTaskLog(taskId: string, events: any[]): Promise<void> {
    if (!taskId) return;
    this.eventsByTaskId.set(taskId, [...events]);
  }

  async readTaskLog(taskId: string): Promise<any[] | null> {
    if (!taskId) return null;
    const events = this.eventsByTaskId.get(taskId);
    return events ? [...events] : null;
  }
}

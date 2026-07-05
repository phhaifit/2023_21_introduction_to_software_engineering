import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

export interface TaskLogRepository {
  saveTaskLog(taskId: string, events: any[]): Promise<void>;
  readTaskLog(taskId: string): Promise<any[] | null>;
}

export class FileSystemTaskLogRepository implements TaskLogRepository {
  private readonly baseDir: string;

  constructor(baseDir: string = "./task-logs") {
    this.baseDir = baseDir;
  }

  async saveTaskLog(taskId: string, events: any[]): Promise<void> {
    if (!taskId) return;
    try {
      await mkdir(this.baseDir, { recursive: true });
      const filePath = join(this.baseDir, `${taskId}.json`);
      const payload = {
        taskId,
        updatedAt: new Date().toISOString(),
        events
      };
      await writeFile(filePath, JSON.stringify(payload, null, 2), "utf-8");
    } catch (err) {
      console.error(`[FileSystemTaskLogRepository] Failed to save log for task ${taskId}:`, err);
    }
  }

  async readTaskLog(taskId: string): Promise<any[] | null> {
    if (!taskId) return null;
    const filePath = join(this.baseDir, `${taskId}.json`);
    try {
      const content = await readFile(filePath, "utf-8");
      const parsed = JSON.parse(content);
      return Array.isArray(parsed.events) ? parsed.events : null;
    } catch {
      return null;
    }
  }
}

export class NoOpTaskLogRepository implements TaskLogRepository {
  async saveTaskLog(): Promise<void> {}
  async readTaskLog(): Promise<any[] | null> {
    return null;
  }
}

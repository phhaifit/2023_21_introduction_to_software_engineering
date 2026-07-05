import { describe, it, expect, afterAll } from "vitest";
import { rm } from "node:fs/promises";
import { join } from "node:path";
import { FileSystemTaskLogRepository, InMemoryTaskLogRepository } from "./task-log-repository.ts";

describe("FileSystemTaskLogRepository", () => {
  const testDir = "./test-task-logs";
  const repository = new FileSystemTaskLogRepository(testDir);

  afterAll(async () => {
    try {
      await rm(testDir, { recursive: true, force: true });
    } catch (err) {
      // ignore
    }
  });

  it("saves and reads task logs successfully", async () => {
    const taskId = "task-test-123";
    const testEvents = [
      { type: "execution-started", taskId, timestamp: "2026-07-01T15:00:00Z" },
      { type: "sub-activity", taskId, activityType: "tool", details: "running list_dir", timestamp: "2026-07-01T15:00:01Z" },
      { type: "execution-completed", taskId, finalOutput: "done", timestamp: "2026-07-01T15:00:02Z" }
    ];

    await repository.saveTaskLog(taskId, testEvents);

    const readEvents = await repository.readTaskLog(taskId);
    expect(readEvents).not.toBeNull();
    expect(readEvents).toHaveLength(3);
    expect(readEvents![0].type).toBe("execution-started");
    expect(readEvents![1].activityType).toBe("tool");
    expect(readEvents![2].finalOutput).toBe("done");
  });

  it("returns null for non-existent task log", async () => {
    const result = await repository.readTaskLog("non-existent-task");
    expect(result).toBeNull();
  });
});

describe("InMemoryTaskLogRepository", () => {
  it("saves and reads task logs without requiring filesystem persistence", async () => {
    const repository = new InMemoryTaskLogRepository();
    const taskId = "task-memory-123";
    const events = [
      { type: "execution-started", taskId },
      { type: "execution-completed", taskId, finalOutput: "done" }
    ];

    await repository.saveTaskLog(taskId, events);

    expect(await repository.readTaskLog(taskId)).toEqual(events);
    expect(await repository.readTaskLog("missing")).toBeNull();
  });
});

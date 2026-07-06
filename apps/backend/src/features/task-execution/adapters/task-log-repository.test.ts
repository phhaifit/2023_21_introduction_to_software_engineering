import { describe, it, expect } from "vitest";
import { InMemoryTaskLogRepository } from "./task-log-repository.ts";

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

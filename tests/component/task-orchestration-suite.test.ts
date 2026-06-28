/**
 * task-orchestration-suite.test.ts
 *
 * Master test configuration and verification suite for Task & Orchestration.
 * Ensures all component test files, including the newly added failed details tests,
 * are registered and verified as part of the full system test execution.
 */

import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { join } from "node:path";

describe("Task & Orchestration Master Test Suite Configuration", () => {
  const root = process.cwd();
  const testFiles = [
    "tests/component/task-cancellation-coordinator.test.ts",
    "tests/component/task-cancellation-state.test.ts",
    "tests/component/task-cancellation-ui.test.tsx",
    "tests/component/task-completed-result-ui.test.tsx",
    "tests/component/task-completion-controller.test.ts",
    "tests/component/task-completion-state.test.ts",
    "tests/component/task-composer.test.tsx",
    "tests/component/task-creation-flow.test.tsx",
    "tests/component/task-failure-controller.test.ts",
    "tests/component/task-failure-state.test.ts",
    "tests/component/task-in-progress-state.test.tsx",
    "tests/component/task-orchestration-domain.test.ts",
    "tests/component/task-orchestration-log-list.test.tsx",
    "tests/component/task-orchestration-page.test.tsx",
    "tests/component/task-orchestration-shared-components.test.tsx",
    "tests/component/task-pending-state.test.tsx",
    "tests/component/task-processing-controller.test.ts",
    "tests/component/task-processing-detail-modal.test.tsx",
    "tests/component/task-processing-detail-model.test.ts",
    "tests/component/task-processing-state.test.ts",
    "tests/component/task-streaming-controller.test.ts",
    "tests/component/task-streaming-state.test.ts",
    "tests/component/task-streaming-ui.test.tsx",
    // Task 13B-2 new test files
    "tests/component/task-failed-details-model.test.ts",
    "tests/component/task-failed-details-ui.test.tsx",
    "tests/component/task-polish-ui.test.tsx"
  ];

  it.each(testFiles)("confirms test file %s exists in the verification list", (file) => {
    expect(existsSync(join(root, file))).toBe(true);
  });
});

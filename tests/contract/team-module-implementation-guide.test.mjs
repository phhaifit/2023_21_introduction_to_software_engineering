import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../", import.meta.url));
const readmePath = join(root, "README.md");
const guidePath = join(root, "docs/team-module-implementation-guide.md");
const openspecGuidePath = join(root, "docs/openspec-team-guide.md");
const moduleOwnershipPath = join(root, "docs/module-ownership.md");
const prChecklistPath = join(root, "docs/pr-checklist.md");

assert.ok(existsSync(guidePath), "team module implementation guide must exist");

const readme = readFileSync(readmePath, "utf8");
const guide = readFileSync(guidePath, "utf8");
const openspecGuide = readFileSync(openspecGuidePath, "utf8");
const moduleOwnership = readFileSync(moduleOwnershipPath, "utf8");
const prChecklist = readFileSync(prChecklistPath, "utf8");

for (const link of [
  "docs/requirements.md",
  "docs/architecture.md",
  "docs/module-ownership.md",
  "docs/team-module-implementation-guide.md",
  "docs/openspec-team-guide.md",
  "docs/api/module-api-contracts.md",
  "docs/pr-checklist.md"
]) {
  assert.ok(readme.includes(link), `README must link to ${link}`);
}

for (const forbiddenReadmeSection of [
  "Nền tảng tập trung vào các khả năng chính",
  "Hướng dẫn Manual Test",
  "Manual Test cho Agent Management",
  "Research Agent",
  "Support Agent"
]) {
  assert.doesNotMatch(
    readme,
    new RegExp(escapeRegExp(forbiddenReadmeSection), "i"),
    `README must stay overview-only and not include '${forbiddenReadmeSection}'`
  );
}

for (const requiredGuideSection of [
  "## Read Before Coding",
  "## Start a Module Task",
  "## Module Boundary Rules",
  "## Per-Module Checklist",
  "## Shared Boundary Change Rule",
  "## Required Commands",
  "## PR Handoff"
]) {
  assert.ok(guide.includes(requiredGuideSection), `guide must include ${requiredGuideSection}`);
}

for (const requiredChecklistItem of [
  "Active OpenSpec change",
  "API matrix section",
  "Shared Contracts",
  "Prisma and Persistence",
  "Domain Events and Workers",
  "Out of Scope",
  "No `.local-docs/` file is staged or committed"
]) {
  assert.ok(guide.includes(requiredChecklistItem), `guide checklist must include ${requiredChecklistItem}`);
}

assert.ok(
  openspecGuide.includes("docs/team-module-implementation-guide.md"),
  "OpenSpec team guide must include the team module implementation guide in the reading path"
);
assert.ok(
  moduleOwnership.includes("docs/team-module-implementation-guide.md"),
  "module ownership doc must point module owners to the implementation guide"
);
assert.ok(
  prChecklist.includes("docs/team-module-implementation-guide.md"),
  "PR checklist must point reviewers to the implementation guide"
);

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

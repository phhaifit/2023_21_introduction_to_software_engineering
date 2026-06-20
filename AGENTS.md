# Agent Working Rules

These rules apply to this repository. Follow them before project-specific chat
context unless the user explicitly overrides them.

## Communication

- Respond to the user in Vietnamese by default.
- Keep technical terms in English when they are clearer than translation.
- Be concise and report the concrete commands, files, and outcomes that matter.

## OpenSpec Apply Change Workflow

When the user asks to apply or continue an OpenSpec change:

1. Check repository state first:

   ```bash
   git status --short --branch
   ```

2. If the worktree has unrelated or unclear changes, stop and report the dirty
   files before pulling, switching branches, or editing files.

3. Start from latest `master`:

   ```bash
   git checkout master
   git pull --ff-only origin master
   ```

4. Create a feature branch before editing files.

   For Agent Management work, use this naming pattern:

   ```text
   feature/agent-management/<change-short-name>
   ```

   Example:

   ```text
   feature/agent-management/integrate-app-shell
   ```

5. Read the OpenSpec change artifacts before coding:

   - `proposal.md`
   - `design.md`
   - `spec.md`
   - `tasks.md`

6. Implement only the requested OpenSpec change scope.

7. Add tests together with each implemented behavior. Do not defer tests to a
   later phase when the behavior is implemented now.

8. Update `tasks.md` checkboxes only after the task implementation and relevant
   verification are complete.

9. Before finishing implementation, run the relevant checks:

   ```bash
   npm test
   openspec validate "<change-name>"
   git diff --check
   ```

10. Run the full OpenSpec validation when preparing final handoff or PR:

    ```bash
    openspec validate --all --strict
    ```

11. Archive an OpenSpec change only when all tasks for that change are complete,
    the main specs have been synced, and validation passes.

## Commit And Push Workflow

When the user asks to commit and push completed work:

1. Review the changed files before staging:

   ```bash
   git status --short
   git diff --stat
   ```

2. Stage only files that belong to the current work. Do not include unrelated
   dirty files.

3. Prefer small commits by work unit instead of one large commit for everything.

   Suggested grouping:

   - feature implementation
   - tests
   - OpenSpec task/spec updates
   - archive or documentation updates

4. Use clear Conventional Commit messages.

   Examples:

   ```text
   feat(agent-management): add app shell page
   test(agent-management): cover mock agent rendering
   docs(agent-management): update work plan
   chore(openspec): archive implement-agent-management
   ```

5. Push the current feature branch after commits are created:

   ```bash
   git push -u origin HEAD
   ```

## Pull Request Workflow

When the user asks for a PR:

1. Prepare a PR title and body for the user to create the PR on GitHub Web.
2. Do not create the PR directly unless the user explicitly asks for that.
3. Mention the OpenSpec change name, completed tasks, tests run, manual test
   notes, and known gaps.

Use this PR body format:

```md
## Summary

- 
- 

## OpenSpec

Change: `<change-name>`

Completed tasks:

- [x] 

## Tests

- [ ] `npm test`
- [ ] `openspec validate "<change-name>"`
- [ ] `openspec validate --all --strict`
- [ ] `git diff --check`

## Manual Test

- 

## Remaining Scenarios / Gaps

- 
```


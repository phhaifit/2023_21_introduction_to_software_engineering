## 1. Membership Domain

- [ ] 1.1 Define workspace member, invitation, role, and membership status model
- [ ] 1.2 Implement member and invitation repository or persistence interfaces
- [ ] 1.3 Implement member list and invitation list use cases

## 2. RBAC Behavior

- [ ] 2.1 Implement admin-only invitation creation
- [ ] 2.2 Implement role update with `admin`, `editor`, and `viewer` validation
- [ ] 2.3 Implement member removal and access revocation
- [ ] 2.4 Wire shared RBAC permission checks for protected workspace actions

## 3. Frontend Experience

- [ ] 3.1 Build member list and pending invitation UI
- [ ] 3.2 Build invite-member flow with role selection
- [ ] 3.3 Build role update and member removal controls with permission-aware states

## 4. Verification and Handoff

- [ ] 4.1 Add tests for invitation, role update, member removal, and forbidden non-admin actions
- [ ] 4.2 Add tests for admin/editor/viewer permission behavior on representative workspace actions
- [ ] 4.3 Run OpenSpec validation and relevant test commands
- [ ] 4.4 Update module README with role matrix and RBAC assumptions

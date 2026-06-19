## ADDED Requirements

### Requirement: Workspace Member Invitation
The system SHALL allow workspace admins to invite members by email.

#### Scenario: Invitation created
- **WHEN** an admin invites a valid email to a workspace
- **THEN** the system creates a pending invitation with an assigned workspace role

#### Scenario: Non-admin invitation rejected
- **WHEN** a non-admin tries to invite a member
- **THEN** the system rejects the request with a forbidden error response

### Requirement: Workspace Member List
The system SHALL show authorized users the members and pending invitations in a workspace.

#### Scenario: Member list viewed
- **WHEN** an authorized workspace user opens member management
- **THEN** the system returns current members, pending invitations, roles, and membership statuses

### Requirement: Workspace Role Management
The system SHALL allow admins to assign `admin`, `editor`, or `viewer` roles to workspace members.

#### Scenario: Role updated
- **WHEN** an admin changes a member role to a valid role
- **THEN** the system updates the member's workspace role and future permission checks use the new role

#### Scenario: Invalid role rejected
- **WHEN** an admin attempts to assign an unsupported role
- **THEN** the system rejects the request with a validation error response

### Requirement: Workspace Member Removal
The system SHALL allow admins to remove members from a workspace.

#### Scenario: Member removed
- **WHEN** an admin removes a workspace member
- **THEN** the system revokes the member's workspace access

### Requirement: Workspace RBAC Enforcement
The system SHALL enforce workspace-scoped permissions using shared RBAC rules.

#### Scenario: Viewer cannot modify workspace resources
- **WHEN** a viewer attempts to create, update, or delete a protected workspace resource
- **THEN** the system rejects the action with a forbidden error response

#### Scenario: Editor can modify allowed resources
- **WHEN** an editor performs an allowed agent or workflow editing action
- **THEN** the system permits the action when all other validation passes

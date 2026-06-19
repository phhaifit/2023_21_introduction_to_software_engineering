## ADDED Requirements

### Requirement: User Registration
The system SHALL allow a new user to register with email and password.

#### Scenario: Successful registration
- **WHEN** a user submits a valid unused email and valid password
- **THEN** the system creates the user with a hashed password and returns a successful API response without exposing the password

#### Scenario: Invalid registration rejected
- **WHEN** a user submits an invalid email, weak password, or already-used email
- **THEN** the system rejects the request with a shared API error response

### Requirement: User Login
The system SHALL authenticate users with email and password.

#### Scenario: Successful login
- **WHEN** a registered user submits the correct email and password
- **THEN** the system returns an authenticated session or access token and the user's safe profile data

#### Scenario: Invalid login rejected
- **WHEN** a user submits an unknown email or incorrect password
- **THEN** the system rejects the request without revealing which credential was incorrect

### Requirement: User Logout
The system SHALL allow authenticated users to end the active session.

#### Scenario: Active session invalidated
- **WHEN** an authenticated user logs out
- **THEN** the backend invalidates the active session or token and the frontend clears authenticated state

### Requirement: Authenticated Request Context
The system SHALL resolve authenticated user context for protected backend routes.

#### Scenario: Protected request has context
- **WHEN** a request includes a valid active session or token
- **THEN** protected route handlers receive a request context containing the authenticated user identity

#### Scenario: Protected request without valid auth
- **WHEN** a request omits authentication or uses an invalid session or token
- **THEN** the system rejects the request with an unauthorized error response

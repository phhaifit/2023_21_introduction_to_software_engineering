# Backend

Backend uses a modular monolith layout. Each capability owns its module folder under `src/modules/<capability>` and depends on shared contracts or shared infrastructure only through public interfaces.

Rules:

- Do not import another capability module's internal repository or service.
- Put cross-module values in `shared/contracts`.
- Put reusable platform concerns in `src/shared`.
- Keep feature-specific API handlers, services, repositories, and tests inside the owning module.

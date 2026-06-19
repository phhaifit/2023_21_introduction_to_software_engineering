# Workers

Workers run asynchronous jobs that should not block HTTP requests.

Foundation job groups:

- `openclaw-provisioning`: create, stop, delete, or resize OpenClaw runtimes.
- `payment-webhook`: reconcile payment provider callbacks.
- `document-ingestion`: parse documents and prepare vector indexing.
- `task-execution`: execute long-running agent/workflow tasks.

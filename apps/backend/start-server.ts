import { createLocalAgentManagementRuntime } from "./src/local-agent-management-server.ts";

const { app } = await createLocalAgentManagementRuntime();

const server = app.listen(3001, "127.0.0.1", () => {
  console.log("Backend running on http://127.0.0.1:3001");
});

// Keep process alive
setInterval(() => {}, 1 << 30);

process.on("SIGTERM", () => {
  server.close(() => process.exit(0));
});
process.on("SIGINT", () => {
  server.close(() => process.exit(0));
});

/**
 * Loads and validates environment variables.
 * In local development, they are loaded via the `--env-file` flag of Node/tsx.
 */
export function loadBackendEnvironment(): void {
  // Environment variables are already loaded via --env-file in the package.json scripts.
  // This function can be used to validate required keys.
  if (!process.env.GEMINI_API_KEY && !process.env.OPENROUTER_API_KEY) {
    console.warn(
      "[Warning] Neither GEMINI_API_KEY nor OPENROUTER_API_KEY is configured. " +
      "AI features might fail. Please check your .env file."
    );
  }
}

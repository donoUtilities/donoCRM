/**
 * Validates and exports required environment variables.
 * Import `env` instead of using `process.env.XXX!` directly — this
 * gives a clear boot-time error when a var is missing rather than
 * a cryptic runtime crash deep in a request handler.
 */

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

function optional(name: string, fallback: string): string {
  return process.env[name] || fallback;
}

export const env = {
  // Google OAuth
  AUTH_GOOGLE_ID: required("AUTH_GOOGLE_ID"),
  AUTH_GOOGLE_SECRET: required("AUTH_GOOGLE_SECRET"),

  // Google Docs/Drive templates & folder
  GOOGLE_DOC_TEMPLATE_ADMIN: required("GOOGLE_DOC_TEMPLATE_ADMIN"),
  GOOGLE_DOC_TEMPLATE_TEAM: required("GOOGLE_DOC_TEMPLATE_TEAM"),
  GOOGLE_DRIVE_FOLDER_ID: required("GOOGLE_DRIVE_FOLDER_ID"),

  // MongoDB
  NUXT_DONO_MONGODB_URI: required("NUXT_DONO_MONGODB_URI"),

  // AppSheet
  APPSHEET_APP_ID: required("APPSHEET_APP_ID"),
  APPSHEET_ACCESS_KEY: required("APPSHEET_ACCESS_KEY"),

  // Concurrency (optional, has a code-level fallback)
  INVOICE_BATCH_CONCURRENCY: optional("INVOICE_BATCH_CONCURRENCY", "4"),
};

/**
 * Environment configuration validator.
 * Called once at server startup. Fails hard on missing required vars;
 * warns on missing optional vars so the team knows what is degraded.
 */

const REQUIRED = ['NODE_ENV', 'PORT', 'DB_PATH'];

const OPTIONAL_WITH_WARNINGS = {
  ANTHROPIC_API_KEY: 'AI features (Artifact Ingestion, Knowledge Hub, Interview Studio AI Review) will be unavailable.',
  AZURE_TENANT_ID:   'SharePoint integration is stubbed. Set Azure AD credentials to enable it.',
  AZURE_CLIENT_ID:   'SharePoint integration is stubbed.',
  AZURE_CLIENT_SECRET: 'SharePoint integration is stubbed.',
};

function validateEnv() {
  const missing = REQUIRED.filter(key => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(
      `[Env] Missing required environment variables: ${missing.join(', ')}\n` +
      'Copy .env.example to .env and fill in the required values.'
    );
  }

  for (const [key, warning] of Object.entries(OPTIONAL_WITH_WARNINGS)) {
    if (!process.env[key]) {
      console.warn(`[Env] ⚠️  ${key} not set — ${warning}`);
    }
  }

  console.log(`[Env] Environment: ${process.env.NODE_ENV}`);
}

module.exports = { validateEnv };

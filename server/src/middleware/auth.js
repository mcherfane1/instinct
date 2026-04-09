/**
 * Authentication middleware — LOCAL DEV STUB
 *
 * Phase 1: Attaches a hardcoded user to req.user.
 *          Use the X-User-Role header to test different roles:
 *            X-User-Role: Engagement Lead   (default)
 *            X-User-Role: Team Member
 *            X-User-Role: Viewer
 *
 * Phase 3: Replace this entire file with Azure AD / Entra ID JWT validation.
 *          Decode the Bearer token, verify signature against the JWKS endpoint,
 *          extract claims (oid, name, email, roles), and populate req.user.
 *          The shape of req.user must remain identical so downstream
 *          middleware (rbac.js, auditLogger.js) requires no changes.
 */

const DEFAULT_USER = {
  userId:   'local-dev-lead',
  name:     'Local Dev Lead',
  email:    'lead@hummingbird.local',
  role:     'Engagement Lead',
};

const VALID_ROLES = ['Engagement Lead', 'Team Member', 'Viewer'];

function authMiddleware(req, res, next) {
  const roleOverride = req.headers['x-user-role'];
  const role = VALID_ROLES.includes(roleOverride) ? roleOverride : DEFAULT_USER.role;

  req.user = { ...DEFAULT_USER, role };
  next();
}

module.exports = { authMiddleware };

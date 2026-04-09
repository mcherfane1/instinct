/**
 * Role-based access control middleware (PRD §4).
 * Enforced server-side — not just UI hiding (PRD §12.3).
 *
 * Role hierarchy:
 *   Engagement Lead (3) > Team Member (2) > Viewer (1)
 */

const ROLE_LEVEL = {
  'Engagement Lead': 3,
  'Team Member':     2,
  'Viewer':          1,
};

function requireRole(minRole) {
  return (req, res, next) => {
    const userLevel     = ROLE_LEVEL[req.user?.role] || 0;
    const requiredLevel = ROLE_LEVEL[minRole]        || 0;

    if (userLevel < requiredLevel) {
      return res.status(403).json({
        error:   'Forbidden',
        message: `This action requires the "${minRole}" role. Your role: "${req.user?.role}".`,
      });
    }
    next();
  };
}

const requireEngagementLead = requireRole('Engagement Lead');
const requireTeamMember     = requireRole('Team Member');
const requireViewer         = requireRole('Viewer');

module.exports = { requireRole, requireEngagementLead, requireTeamMember, requireViewer };

import { RequestHandler } from 'express';
import { AppError } from './errors';

const FEATURE_ENV = {
  READ_ONLY_LIFECYCLE: 'FEATURE_READ_ONLY_LIFECYCLE', WORKFLOW_FOUNDATION: 'FEATURE_WORKFLOW_FOUNDATION',
  INQUIRY: 'FEATURE_INQUIRY', DESIGN: 'FEATURE_DESIGN', COMPLIANCE: 'FEATURE_COMPLIANCE',
  PRECONSTRUCTION: 'FEATURE_PRECONSTRUCTION', PROCUREMENT: 'FEATURE_PROCUREMENT',
} as const;
export type FeatureName = keyof typeof FEATURE_ENV;
export const getFeatureFlags = () => Object.fromEntries(Object.entries(FEATURE_ENV).map(([name,env])=>[name,process.env[env]!=='false'])) as Record<FeatureName,boolean>;

export const requireFeature = (feature: FeatureName, matches: RegExp): RequestHandler => (req, _res, next) => {
  if (!matches.test(req.path)) return next();
  if (!getFeatureFlags()[feature]) return next(new AppError(`${feature} is disabled by release control.`, 503, 'INTERNAL_ERROR'));
  next();
};

export const workflowFeatureGuard: RequestHandler = (req, _res, next) => {
  const workflowPath=/^\/(?:projects\/[^/]+\/(?:command-center|work-items|decisions|assignments|stages)|work-items|decisions|assignments)(?:\/|$)/;
  if(!workflowPath.test(req.path))return next();
  const flags=getFeatureFlags();
  if (flags.WORKFLOW_FOUNDATION) return next();
  if (req.method === 'GET' && flags.READ_ONLY_LIFECYCLE && req.path.endsWith('/command-center')) return next();
  next(new AppError('Workflow mutations are disabled by release control.', 503, 'INTERNAL_ERROR'));
};

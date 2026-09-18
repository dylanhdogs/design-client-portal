import rateLimit from 'express-rate-limit';

const handler = (message: string) => (_req: any, res: any) => {
  res.status(429).json({
    error: {
      code: 'CONFLICT',
      message,
    },
  });
};

export const invitationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  handler: handler('Too many invitation requests. Please try again later.'),
});

export const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  standardHeaders: true,
  legacyHeaders: false,
  handler: handler('Too many upload requests. Please try again later.'),
});

export const approvalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  handler: handler('Too many approval requests. Please slow down.'),
});

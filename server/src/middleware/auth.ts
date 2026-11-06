import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  const isDefaultDev = secret === 'krishisetu-dev-secret-key-32-chars-long';
  const isTooShort = !secret || secret.trim().length < 32;

  if (process.env.NODE_ENV === 'production') {
    if (isTooShort || isDefaultDev) {
      throw new Error('FATAL: Insecure or missing JWT_SECRET in production environment! A robust secret of at least 32 characters is required.');
    }
  }

  return secret || 'krishisetu-dev-secret-key-32-chars-long';
}

export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  role: 'OPERATOR' | 'MANAGER';
  centreId?: string | null;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export function signJwtToken(user: AuthUser): string {
  const secret = getJwtSecret();
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      centreId: user.centreId || null
    },
    secret,
    { expiresIn: '7d' }
  );
}

export function authenticateToken(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ success: false, error: 'Authentication required. No session token provided.' });
  }

  try {
    const secret = getJwtSecret();
    const decoded = jwt.verify(token, secret) as AuthUser;
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(403).json({ success: false, error: 'Invalid or expired session token.' });
  }
}

export function requireRole(allowedRoles: Array<'OPERATOR' | 'MANAGER'>) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Authentication required.' });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: `Access denied. Requires role: ${allowedRoles.join(' or ')}.`
      });
    }

    next();
  };
}

/**
 * Enforces collection centre boundaries:
 * - MANAGER: unrestricted access across all centres.
 * - OPERATOR: strictly restricted to their assigned centreId.
 */
export function enforceCentreAccess(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ success: false, error: 'Authentication required.' });
  }

  if (req.user.role === 'OPERATOR') {
    if (!req.user.centreId) {
      return res.status(403).json({
        success: false,
        error: 'Access denied: Operator account is not assigned to any collection centre.'
      });
    }

    const requestedCentreId = req.params.centreId || req.query.centreId || req.body.centreId;
    if (requestedCentreId && requestedCentreId !== 'ALL' && requestedCentreId !== req.user.centreId) {
      return res.status(403).json({
        success: false,
        error: 'Access denied: Operators cannot view or create records for other collection centres.'
      });
    }
  }

  next();
}

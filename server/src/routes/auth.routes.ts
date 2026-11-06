import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma';
import { signJwtToken, authenticateToken } from '../middleware/auth';

const router = Router();

// Demo accounts for instant sign-in or testing
export const DEMO_CREDENTIALS = {
  operator: {
    email: 'operator.c07@krishisetu.in',
    password: 'password123',
    role: 'CENTRE OPERATOR',
    centreCode: 'C07',
    centreName: 'Ausa Central Collection Centre'
  },
  manager: {
    email: 'manager@krishisetu.in',
    password: 'password123',
    role: 'OFFICE MANAGER',
    scope: 'Central Office – All 22 Centres'
  }
};

/**
 * POST /api/auth/login
 */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'Email and password are required.' });
    }

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
      include: { centre: true }
    });

    if (!user) {
      return res.status(401).json({ success: false, error: 'Invalid email or password.' });
    }

    const passwordMatches = await bcrypt.compare(password, user.passwordHash);
    if (!passwordMatches) {
      return res.status(401).json({ success: false, error: 'Invalid email or password.' });
    }

    const token = signJwtToken({
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role as 'OPERATOR' | 'MANAGER',
      centreId: user.centreId
    });

    return res.json({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        centreId: user.centreId,
        centre: user.centre ? {
          id: user.centre.id,
          code: user.centre.code,
          name: user.centre.name,
          village: user.centre.village,
          taluka: user.centre.taluka
        } : null
      }
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message || 'Login failed.' });
  }
});

/**
 * GET /api/auth/me
 */
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      include: { centre: true }
    });

    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found.' });
    }

    return res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        centreId: user.centreId,
        centre: user.centre
      }
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/auth/demo-credentials
 */
router.get('/demo-credentials', (req, res) => {
  return res.json({
    success: true,
    accounts: DEMO_CREDENTIALS
  });
});

export default router;


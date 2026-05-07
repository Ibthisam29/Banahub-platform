import { Request, Response } from 'express';
import { Member } from '../models/member.model';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../utils/jwt';
import { AuthRequest } from '../utils/auth.middleware';

export async function register(req: Request, res: Response): Promise<void> {
  try {
    const { email, password, fullName, institution, region, title } = req.body;

    const existing = await Member.findOne({ email });
    if (existing) {
      res.status(409).json({ error: 'Email already registered' });
      return;
    }

    const member = await Member.create({
      email,
      password,
      profile: { fullName, institution, region, title },
    });

    const payload = { userId: String(member._id), role: member.role, tier: member.membership.tier };
    res.status(201).json({
      accessToken: signAccessToken(payload),
      refreshToken: signRefreshToken(payload),
      member: {
        id: member._id,
        email: member.email,
        profile: member.profile,
        membership: member.membership,
      },
    });
  } catch (err) {
    res.status(500).json({ error: 'Registration failed' });
  }
}

export async function login(req: Request, res: Response): Promise<void> {
  try {
    const { email, password } = req.body;

    const member = await Member.findOne({ email });
    if (!member || !(await member.comparePassword(password))) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const payload = { userId: String(member._id), role: member.role, tier: member.membership.tier };
    res.json({
      accessToken: signAccessToken(payload),
      refreshToken: signRefreshToken(payload),
      member: {
        id: member._id,
        email: member.email,
        profile: member.profile,
        membership: member.membership,
      },
    });
  } catch {
    res.status(500).json({ error: 'Login failed' });
  }
}

export async function refresh(req: Request, res: Response): Promise<void> {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) { res.status(400).json({ error: 'Refresh token required' }); return; }

    const payload = verifyRefreshToken(refreshToken);
    const member = await Member.findById(payload.userId);
    if (!member) { res.status(401).json({ error: 'Member not found' }); return; }

    const newPayload = { userId: String(member._id), role: member.role, tier: member.membership.tier };
    res.json({
      accessToken: signAccessToken(newPayload),
      refreshToken: signRefreshToken(newPayload),
    });
  } catch {
    res.status(401).json({ error: 'Invalid refresh token' });
  }
}

export async function logout(_req: Request, res: Response): Promise<void> {
  res.json({ message: 'Logged out successfully' });
}

export async function me(req: AuthRequest, res: Response): Promise<void> {
  try {
    const member = await Member.findById(req.user?.userId).select('-password');
    if (!member) { res.status(404).json({ error: 'Member not found' }); return; }
    res.json({ member });
  } catch {
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
}

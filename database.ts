import { Request, Response } from 'express';
import { Member } from '../models/member.model';

export async function getMembers(req: Request, res: Response): Promise<void> {
  try {
    const { region, tier, status, page = '1', limit = '20' } = req.query;
    const filter: Record<string, unknown> = {};
    if (region) filter['profile.region'] = region;
    if (tier) filter['membership.tier'] = tier;
    if (status) filter['membership.status'] = status;

    const skip = (parseInt(String(page)) - 1) * parseInt(String(limit));
    const [members, total] = await Promise.all([
      Member.find(filter).select('-password').skip(skip).limit(parseInt(String(limit))).sort({ createdAt: -1 }),
      Member.countDocuments(filter),
    ]);

    res.json({ members, total, page: parseInt(String(page)), pages: Math.ceil(total / parseInt(String(limit))) });
  } catch {
    res.status(500).json({ error: 'Failed to fetch members' });
  }
}

export async function getMember(req: Request, res: Response): Promise<void> {
  try {
    const member = await Member.findById(req.params.id).select('-password');
    if (!member) { res.status(404).json({ error: 'Member not found' }); return; }
    res.json({ member });
  } catch {
    res.status(500).json({ error: 'Failed to fetch member' });
  }
}

export async function updateMemberStatus(req: Request, res: Response): Promise<void> {
  try {
    const { status, feeStatus, tier } = req.body;
    const update: Record<string, unknown> = {};
    if (status) update['membership.status'] = status;
    if (feeStatus) update['membership.feeStatus'] = feeStatus;
    if (tier) update['membership.tier'] = tier;

    const member = await Member.findByIdAndUpdate(req.params.id, { $set: update }, { new: true }).select('-password');
    if (!member) { res.status(404).json({ error: 'Member not found' }); return; }
    res.json({ member });
  } catch {
    res.status(500).json({ error: 'Failed to update member' });
  }
}

export async function getStats(_req: Request, res: Response): Promise<void> {
  try {
    const [total, pending, founding, standard] = await Promise.all([
      Member.countDocuments(),
      Member.countDocuments({ 'membership.status': { $in: ['pending', 'manual_vetting'] } }),
      Member.countDocuments({ 'membership.tier': 'founding' }),
      Member.countDocuments({ 'membership.tier': 'standard' }),
    ]);
    res.json({ total, pendingVerifications: pending, founding, standard });
  } catch {
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
}

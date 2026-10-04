import type { VercelRequest, VercelResponse } from '@vercel/node';
import { placeBid } from '../../lib/auctionEngine.js';
import { requireUser } from '../../lib/adminAuth.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  const user = await requireUser(req, res);
  if (!user) return;

  const { playerId, teamId, amount, increment_used } = req.body ?? {};
  const isAdmin = user.role === 'ADMIN';

  // Only admins may bid for an arbitrary team or override bid rules.
  // Team owners always bid for their own team, whatever the client sends.
  const isOverride = isAdmin && req.body?.isOverride === true;
  const effectiveTeamId = isAdmin ? teamId : user.teamId;

  if (!isAdmin && user.role !== 'TEAM_OWNER') {
    return res.status(403).json({ error: 'Only team owners can place bids' });
  }
  if (!playerId || !effectiveTeamId) {
    return res.status(400).json({ error: 'playerId and a team are required' });
  }

  const numericAmount = Number(amount);
  if (!Number.isInteger(numericAmount) || numericAmount <= 0) {
    return res.status(400).json({ error: 'Bid amount must be a positive whole number' });
  }

  try {
    const result = await placeBid({
      playerId,
      teamId: effectiveTeamId,
      amount: numericAmount,
      increment_used: Number(increment_used) || 1,
      userId: user.id,
      isOverride,
    });
    return res.status(200).json(result);
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
}

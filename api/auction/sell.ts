import type { VercelRequest, VercelResponse } from '@vercel/node';
import { finalizeSale } from '../../lib/auctionEngine.js';
import { requireAdmin } from '../../lib/adminAuth.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  const adminId = await requireAdmin(req, res);
  if (!adminId) return;

  const { playerId, teamId, price } = req.body;
  try {
    await finalizeSale(playerId, teamId, price);
    return res.status(200).json({ success: true });
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
}

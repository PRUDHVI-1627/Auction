import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseAdmin } from '../../lib/supabaseAdmin.js';
import { requireAdmin } from '../../lib/adminAuth.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  const adminId = await requireAdmin(req, res);
  if (!adminId) return;

  const { playerId, teamId, price } = req.body;

  if (!playerId || !teamId || price === undefined) {
    return res.status(400).json({ error: 'playerId, teamId, and price are required' });
  }

  const numericPrice = Number(price);
  if (!Number.isFinite(numericPrice) || numericPrice < 0) {
    return res.status(400).json({ error: 'Invalid price' });
  }

  const { error } = await supabaseAdmin.rpc('edit_player_sale', {
    p_player_id: playerId,
    p_team_id: teamId,
    p_price: numericPrice,
  });

  if (error) return res.status(400).json({ error: error.message });

  return res.status(200).json({ success: true });
}

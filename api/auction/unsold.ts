import type { VercelRequest, VercelResponse } from '@vercel/node';
import { updateAuctionSessionRecord, supabaseAdmin } from '../../lib/supabaseAdmin.js';
import { requireAdmin } from '../../lib/adminAuth.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).end();
  }

  const adminId = await requireAdmin(req, res);
  if (!adminId) return;

  const { playerId } = req.body;

  if (!playerId) {
    return res.status(400).json({ error: 'playerId is required' });
  }

  try {
    await updateAuctionSessionRecord({ current_player_id: null, timer_expires_at: null });

    const { error: playErr } = await supabaseAdmin
      .from('players')
      .update({ status: 'UNSOLD' })
      .eq('id', playerId);

    if (playErr) return res.status(500).json({ error: playErr.message });
    return res.status(200).json({ success: true });
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
}

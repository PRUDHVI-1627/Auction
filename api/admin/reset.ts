import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getAuctionSessionRecord, supabaseAdmin } from '../../lib/supabaseAdmin.js';
import { requireAdmin } from '../../lib/adminAuth.js';

// Supabase's API layer (safeupdate) rejects DELETE/UPDATE statements without a filter,
// so every statement below carries an explicit one. Doing the reset here rather than in a
// database function also means it works on any database, whatever functions it has.
const ANY_ROW = '00000000-0000-0000-0000-000000000000';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  const adminId = await requireAdmin(req, res);
  if (!adminId) return;

  try {
    const session = await getAuctionSessionRecord();
    const now = new Date().toISOString();

    // stop the live player first so nothing can bid mid-reset
    const { error: sessionErr } = await supabaseAdmin
      .from('auction_session')
      .update({ current_player_id: null, status: 'PAUSED', timer_expires_at: null, started_at: null, ended_at: null })
      .eq('id', session.id);
    if (sessionErr) throw new Error(`session: ${sessionErr.message}`);

    const { error: bidsErr } = await supabaseAdmin.from('bids').delete().neq('id', ANY_ROW);
    if (bidsErr) throw new Error(`bids: ${bidsErr.message}`);

    const { error: playersErr } = await supabaseAdmin
      .from('players')
      .update({ status: 'UPCOMING', sold_to_team_id: null, sold_price: null, updated_at: now })
      .neq('id', ANY_ROW);
    if (playersErr) throw new Error(`players: ${playersErr.message}`);

    const { error: teamsErr } = await supabaseAdmin
      .from('teams')
      .update({ points_spent: 0, updated_at: now })
      .neq('id', ANY_ROW);
    if (teamsErr) throw new Error(`teams: ${teamsErr.message}`);

    return res.status(200).json({ success: true, message: 'Arena logic reset successfully' });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getAuctionSessionRecord, supabaseAdmin } from '../../lib/supabaseAdmin.js';
import { requireAdmin } from '../../lib/adminAuth.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  const adminId = await requireAdmin(req, res);
  if (!adminId) return;

  try {
    await supabaseAdmin
      .from('bids')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');

    await supabaseAdmin
      .from('players')
      .update({ 
        status: 'UPCOMING', 
        sold_to_team_id: null,
        sold_price: null,
        updated_at: new Date().toISOString()
      })
      .neq('id', '00000000-0000-0000-0000-000000000000');

    await supabaseAdmin
      .from('teams')
      .update({ 
        points_spent: 0,
        updated_at: new Date().toISOString()
      })
      .neq('id', '00000000-0000-0000-0000-000000000000');

    const session = await getAuctionSessionRecord();
    await supabaseAdmin
      .from('auction_session')
      .update({ 
        current_player_id: null, 
        status: 'PAUSED',
        timer_expires_at: null 
      })
      .eq('id', session.id);

    return res.status(200).json({ success: true, message: 'Arena logic reset successfully' });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}

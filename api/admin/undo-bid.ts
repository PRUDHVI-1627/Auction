import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseAdmin } from '../../lib/supabaseAdmin.js';
import { requireAdmin } from '../../lib/adminAuth.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).end();
  }

  const adminId = await requireAdmin(req, res);
  if (!adminId) return;

  const { bidId, playerId } = req.body;

  if (!playerId) {
    return res.status(400).json({ error: 'playerId is required' });
  }

  try {
    let targetBidId = bidId as string | undefined;

    if (!targetBidId) {
      const { data: latestBid, error: latestBidErr } = await supabaseAdmin
        .from('bids')
        .select('id')
        .eq('player_id', playerId)
        .eq('is_undone', false)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (latestBidErr) return res.status(500).json({ error: latestBidErr.message });
      if (!latestBid) return res.status(404).json({ error: 'No active bids found for this player' });

      targetBidId = latestBid.id;
    }

    const { error: bidErr } = await supabaseAdmin
      .from('bids')
      .update({ is_undone: true })
      .eq('id', targetBidId);

    if (bidErr) return res.status(500).json({ error: bidErr.message });

    const { data: player, error: playerErr } = await supabaseAdmin
      .from('players')
      .select('base_price')
      .eq('id', playerId)
      .single();

    if (playerErr || !player) {
      return res.status(500).json({ error: playerErr?.message || 'Player not found' });
    }

    const { data: remainingBids, error: remainingErr } = await supabaseAdmin
      .from('bids')
      .select('amount, team_id')
      .eq('player_id', playerId)
      .eq('is_undone', false)
      .order('amount', { ascending: false })
      .limit(1);

    if (remainingErr) return res.status(500).json({ error: remainingErr.message });

    const newTopBid = remainingBids && remainingBids.length > 0 ? remainingBids[0] : null;

    return res.status(200).json({
      success: true,
      bidId: targetBidId,
      currentBid: newTopBid ? newTopBid.amount : player.base_price,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}

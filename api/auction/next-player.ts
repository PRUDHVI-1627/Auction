import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getAuctionSessionRecord, supabaseAdmin } from '../../lib/supabaseAdmin.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).end();
  }

  const requestedPlayerId = req.body?.playerId || null;

  try {
    const session = await getAuctionSessionRecord();

    let nextPlayerId = requestedPlayerId;

    if (!nextPlayerId) {
      const { data: nextUpcoming, error: upcomingErr } = await supabaseAdmin
        .from('players')
        .select('id')
        .eq('status', 'UPCOMING')
        .order('queue_order', { ascending: true })
        .limit(1)
        .maybeSingle();

      if (upcomingErr) {
        return res.status(500).json({ error: upcomingErr.message });
      }

      nextPlayerId = nextUpcoming?.id || null;

      if (!nextPlayerId) {
        const { data: unsoldPlayers, error: unsoldErr } = await supabaseAdmin
          .from('players')
          .select('id')
          .eq('status', 'UNSOLD')
          .order('queue_order', { ascending: true });

        if (unsoldErr) {
          return res.status(500).json({ error: unsoldErr.message });
        }

        if (!unsoldPlayers || unsoldPlayers.length === 0) {
          return res.status(400).json({ error: 'No players remain to be called' });
        }

        const { error: recycleErr } = await supabaseAdmin
          .from('players')
          .update({ status: 'UPCOMING', updated_at: new Date().toISOString() })
          .eq('id', unsoldPlayers[0].id);

        if (recycleErr) {
          return res.status(500).json({ error: recycleErr.message });
        }

        nextPlayerId = unsoldPlayers[0].id;
      }
    }

    if (session.current_player_id && session.current_player_id !== nextPlayerId) {
      await supabaseAdmin
        .from('players')
        .update({ status: 'UPCOMING' })
        .eq('id', session.current_player_id);

      await supabaseAdmin
        .from('bids')
        .update({ is_undone: true })
        .eq('player_id', session.current_player_id)
        .eq('is_undone', false);
    }

    const { data: player, error: playerErr } = await supabaseAdmin
      .from('players')
      .select('base_price')
      .eq('id', nextPlayerId)
      .single();

    if (playerErr || !player) {
      return res.status(400).json({ error: playerErr?.message || 'Player not found' });
    }
    
    const { error: sessErr } = await supabaseAdmin
      .from('auction_session')
      .update({
        current_player_id: nextPlayerId,
        timer_expires_at: null,
        status: 'LIVE'
      })
      .eq('id', session.id);

    const { error: playErr } = await supabaseAdmin
      .from('players')
      .update({ status: 'LIVE' })
      .eq('id', nextPlayerId);

    if (sessErr || playErr) return res.status(500).json({ error: (sessErr || playErr)?.message });

    return res.status(200).json({ success: true, playerId: nextPlayerId });
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
}

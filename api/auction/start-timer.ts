import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getAuctionSessionRecord, supabaseAdmin } from '../../lib/supabaseAdmin.js';
import { requireAdmin } from '../../lib/adminAuth.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  const adminId = await requireAdmin(req, res);
  if (!adminId) return;

  const durationSeconds = Number(req.body?.durationSeconds) || 30;

  try {
    const session = await getAuctionSessionRecord();

    if (session.status !== 'LIVE') {
      return res.status(400).json({ error: 'Auction must be LIVE to start a timer' });
    }

    const expiresAt = new Date(Date.now() + durationSeconds * 1000).toISOString();

    const { error } = await supabaseAdmin
      .from('auction_session')
      .update({ timer_expires_at: expiresAt })
      .eq('id', session.id);

    if (error) return res.status(500).json({ error: error.message });

    return res.status(200).json({ success: true, timer_expires_at: expiresAt });
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
}

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getAuctionSessionRecord, supabaseAdmin } from '../../lib/supabaseAdmin.js';
import { requireAdmin } from '../../lib/adminAuth.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).end();
  }

  const adminId = await requireAdmin(req, res);
  if (!adminId) return;

  try {
    const session = await getAuctionSessionRecord();
    const newStatus = session.status === 'PAUSED' ? 'LIVE' : 'PAUSED';

    const { error: updateErr } = await supabaseAdmin
      .from('auction_session')
      .update({ status: newStatus })
      .eq('id', session.id);

    if (updateErr) return res.status(500).json({ error: updateErr.message });
    return res.status(200).json({ success: true, status: newStatus });
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
}

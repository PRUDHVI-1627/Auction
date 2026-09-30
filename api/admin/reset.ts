import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseAdmin } from '../../lib/supabaseAdmin.js';
import { requireAdmin } from '../../lib/adminAuth.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  const adminId = await requireAdmin(req, res);
  if (!adminId) return;

  try {
    const { error } = await supabaseAdmin.rpc('reset_auction');
    if (error) return res.status(500).json({ error: error.message });

    return res.status(200).json({ success: true, message: 'Arena logic reset successfully' });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}

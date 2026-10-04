import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseAdmin } from '../../lib/supabaseAdmin.js';
import { requireAdmin } from '../../lib/adminAuth.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'POST') {
    const verifiedAdminId = await requireAdmin(req, res);
    if (!verifiedAdminId) return;

    const { message } = req.body ?? {};

    if (typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({ error: 'Message is required' });
    }

    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString(); // 5 min TTL

    const { error: insertErr } = await supabaseAdmin
      .from('announcements')
      .insert([{
        message: message.trim().slice(0, 500),
        created_by_admin_id: verifiedAdminId,
        expires_at: expiresAt,
      }]);

    if (insertErr) return res.status(500).json({ error: insertErr.message });
    return res.status(200).json({ success: true });
  }

  return res.status(405).end();
}

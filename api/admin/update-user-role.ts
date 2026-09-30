import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseAdmin } from '../../lib/supabaseAdmin.js';
import { requireAdmin } from '../../lib/adminAuth.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  const adminId = await requireAdmin(req, res);
  if (!adminId) return;

  const { userId, role, teamId } = req.body;

  if (!userId || !role) {
    return res.status(400).json({ error: 'userId and role are required' });
  }

  if (!['VIEWER', 'TEAM_OWNER', 'ADMIN'].includes(role)) {
    return res.status(400).json({ error: 'Invalid role' });
  }

  const { error } = await supabaseAdmin
    .from('users')
    .update({ role, team_id: teamId ?? null })
    .eq('id', userId);

  if (error) return res.status(500).json({ error: error.message });

  return res.status(200).json({ success: true });
}

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseAdmin } from './supabaseAdmin.js';

export interface AuthedUser {
  id: string;
  role: string | null;
  teamId: string | null;
}

export async function requireUser(req: VercelRequest, res: VercelResponse): Promise<AuthedUser | null> {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    res.status(401).json({ error: 'Authorization token required' });
    return null;
  }

  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) {
    res.status(401).json({ error: 'Invalid or expired token' });
    return null;
  }

  const { data: profile } = await supabaseAdmin
    .from('users')
    .select('role, team_id')
    .eq('id', user.id)
    .maybeSingle();

  return { id: user.id, role: profile?.role ?? null, teamId: profile?.team_id ?? null };
}

export async function requireAdmin(req: VercelRequest, res: VercelResponse): Promise<string | null> {
  const user = await requireUser(req, res);
  if (!user) return null;

  if (user.role !== 'ADMIN') {
    res.status(403).json({ error: 'Admin access required' });
    return null;
  }

  return user.id;
}

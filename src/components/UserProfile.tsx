import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { CircleUser, Wallet, Trophy, Settings, HelpCircle, LogOut, ChevronRight, Bell, History } from 'lucide-react';
import { cn } from '../lib/utils';
import { supabase } from '../lib/supabase';

interface UserProfileProps {
  user: any;
  onLogout?: () => void;
}

export default function UserProfile({ user, onLogout }: UserProfileProps) {
  const [userData, setUserData] = useState<any>(user);
  const [loading, setLoading] = useState(true);
  const [teamData, setTeamData] = useState<any>(null);
  const [rosterSize, setRosterSize] = useState(0);
  const [teamRank, setTeamRank] = useState<number | null>(null);

  useEffect(() => { fetchProfile(); }, []);

  async function fetchProfile() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }
    const { data: profile } = await supabase.from('users').select('*, teams(*)').eq('id', user.id).single();
    setUserData(profile);
    if (profile?.teams) {
      setTeamData(profile.teams);
      const { count } = await supabase.from('players').select('*', { count: 'exact', head: true }).eq('sold_to_team_id', profile.teams.id);
      setRosterSize(count || 0);
      const { data: allTeams } = await supabase.from('teams').select('id, points_spent').order('points_spent', { ascending: false });
      const rank = allTeams?.findIndex(t => t.id === profile.teams.id) ?? -1;
      setTeamRank(rank !== -1 ? rank + 1 : null);
    }
    setLoading(false);
  }

  const handleLogout = async () => {
    await supabase.auth.signOut();
    if (onLogout) onLogout();
  };

  if (loading) return (
    <div className="min-h-screen bg-base flex items-center justify-center">
      <div className="w-6 h-6 border-2 border-border-strong border-t-accent rounded-full animate-spin" />
    </div>
  );

  const budgetRemaining = teamData ? (teamData.total_budget - teamData.points_spent) : 0;
  const budgetPct = teamData ? Math.min(100, (teamData.points_spent / teamData.total_budget) * 100) : 0;
  const teamColor = teamData?.color || 'var(--color-accent)';

  return (
    <div className="min-h-screen bg-base text-ink font-sans pb-32">
      {/* === PROFILE HERO — team-colored top section === */}
      <div className="relative clip-slant-bl" style={{ background: `linear-gradient(135deg, ${teamColor}, ${teamColor}88)` }}>
        <div className="absolute inset-0 pattern-diagonal opacity-20 pointer-events-none" />
        <div className="relative max-w-lg mx-auto px-5 pt-12 pb-20 flex flex-col items-center text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className="w-24 h-24 rounded-full border-4 border-white/30 overflow-hidden bg-black/20 mb-4"
          >
            {userData?.avatar_url ? (
              <img src={userData.avatar_url} alt="Profile" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center"><CircleUser className="w-10 h-10 text-white/60" /></div>
            )}
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          >
            <h1 className="font-hype text-4xl uppercase tracking-wide text-white drop-shadow-sm mb-1">
              {userData?.name || user?.user_metadata?.full_name || 'Player'}
            </h1>
            <p className="text-white/50 text-xs mb-3">{user?.email}</p>
            <span className="inline-block px-3 py-1 bg-white/10 border border-white/20 rounded-full text-[10px] font-bold uppercase tracking-widest text-white/80">
              {userData?.role || 'VIEWER'}
            </span>
          </motion.div>
        </div>
      </div>

      <main className="max-w-lg mx-auto px-5 -mt-8 relative z-10 space-y-5">
        {/* Team card */}
        {userData?.role === 'TEAM_OWNER' && teamData && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className="bg-surface border border-border rounded-xl overflow-hidden"
          >
            <div className="p-5 space-y-5">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2.5">
                  {teamData.logo_url ? (
                    <img src={teamData.logo_url} className="w-10 h-10 rounded-lg border border-border object-cover" />
                  ) : (
                    <div className="p-2 rounded-lg" style={{ background: `${teamColor}15` }}>
                      <Trophy className="w-5 h-5" style={{ color: teamColor }} />
                    </div>
                  )}
                  <div>
                    <span className="font-display font-bold text-ink">{teamData.name}</span>
                    <span className="block text-[10px] text-ink-faint">Your franchise</span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="block text-[9px] text-ink-faint uppercase tracking-widest">Rank</span>
                  <span className="tnum font-bold text-lg" style={{ color: teamColor }}>#{teamRank ?? '—'}</span>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-end">
                  <span className="text-[10px] text-ink-muted uppercase tracking-widest flex items-center gap-1">
                    <Wallet className="w-3 h-3" /> Budget
                  </span>
                  <span className="tnum text-sm font-semibold text-ink">{teamData.points_spent}/{teamData.total_budget}</span>
                </div>
                <div className="h-2 bg-surface-2 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${budgetPct}%` }}
                    transition={{ delay: 0.3, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                    className="h-full rounded-full"
                    style={{ background: teamColor }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-surface-2 p-4 rounded-lg">
                  <span className="block text-[9px] text-ink-faint uppercase tracking-widest mb-1">Roster</span>
                  <span className="tnum text-2xl font-bold text-ink">{String(rosterSize).padStart(2, '0')}<span className="text-xs text-ink-faint font-normal">/11</span></span>
                </div>
                <div className="p-4 rounded-lg border" style={{ background: `${teamColor}08`, borderColor: `${teamColor}20` }}>
                  <span className="block text-[9px] uppercase tracking-widest mb-1" style={{ color: `${teamColor}80` }}>Available</span>
                  <span className="tnum text-2xl font-bold" style={{ color: teamColor }}>{budgetRemaining}</span>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Actions */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="space-y-1.5"
        >
          {[
            { id: 'edit', label: 'Edit profile', sub: 'Name and avatar', icon: Settings },
            { id: 'notifications', label: 'Notifications', sub: 'Bid alerts', icon: Bell },
            { id: 'history', label: 'Bid history', sub: 'Past activity', icon: History },
            { id: 'support', label: 'Support', sub: 'FAQ', icon: HelpCircle },
          ].map((item) => (
            <button
              key={item.id} disabled title="Coming soon"
              className="w-full flex items-center justify-between p-3.5 bg-surface border border-border rounded-lg opacity-40 cursor-not-allowed"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-surface-2"><item.icon className="w-4 h-4 text-ink-faint" /></div>
                <div className="text-left">
                  <span className="block font-medium text-sm text-ink">{item.label}</span>
                  <span className="block text-[10px] text-ink-faint">{item.sub}</span>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-ink-faint" />
            </button>
          ))}

          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-between p-3.5 mt-4 bg-danger/5 hover:bg-danger/10 border border-danger/15 rounded-lg active:scale-[0.98] transition-all"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-danger/10"><LogOut className="w-4 h-4 text-danger" /></div>
              <span className="font-semibold text-sm text-danger">Log out</span>
            </div>
          </button>
        </motion.div>
      </main>
    </div>
  );
}

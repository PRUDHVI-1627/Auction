import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import {
  CircleUser, Wallet, Trophy, Settings,
  HelpCircle, LogOut, ChevronRight, Bell,
  History
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { cn } from '../lib/utils';

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

  useEffect(() => {
    fetchProfile();
  }, []);

  async function fetchProfile() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profile } = await supabase
      .from('users')
      .select('*, teams(*)')
      .eq('id', user.id)
      .single();

    setUserData(profile);
    if (profile?.teams) {
      setTeamData(profile.teams);

      const { count } = await supabase
        .from('players')
        .select('*', { count: 'exact', head: true })
        .eq('sold_to_team_id', profile.teams.id);
      setRosterSize(count || 0);

      const { data: allTeams } = await supabase
        .from('teams')
        .select('id, points_spent')
        .order('points_spent', { ascending: false });
      const rank = allTeams?.findIndex(t => t.id === profile.teams.id) ?? -1;
      setTeamRank(rank !== -1 ? rank + 1 : null);
    }
    setLoading(false);
  }

  const handleLogout = async () => {
    await supabase.auth.signOut();
    if (onLogout) onLogout();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-base flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-border-strong border-t-accent rounded-full animate-spin" />
      </div>
    );
  }

  const budgetRemaining = teamData ? (teamData.total_budget - teamData.points_spent) : 0;
  const budgetProgress = teamData ? Math.min(100, (teamData.points_spent / teamData.total_budget) * 100) : 0;

  return (
    <div className="min-h-screen bg-base text-ink font-sans pt-16 pb-32">
      <main className="max-w-lg mx-auto px-6 space-y-6">
        {/* Identity */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center text-center space-y-3"
        >
          <div className="w-20 h-20 rounded-full border border-border overflow-hidden bg-surface">
            {userData?.avatar_url ? (
              <img src={userData.avatar_url} alt="Profile" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <CircleUser className="w-8 h-8 text-ink-faint" />
              </div>
            )}
          </div>

          <div className="space-y-1">
            <h1 className="font-display font-semibold text-2xl text-ink">
              {userData?.name || user?.user_metadata?.full_name || 'Player'}
            </h1>
            <p className="text-ink-faint text-xs">{user?.email}</p>
          </div>
          <span className="inline-block px-2.5 py-1 bg-surface-2 border border-border rounded-full text-[10px] font-medium uppercase tracking-wide text-ink-muted">
            {userData?.role || 'VIEWER'}
          </span>
        </motion.div>

        {/* Team card */}
        {userData?.role === 'TEAM_OWNER' && teamData && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="bg-surface border border-border rounded-2xl overflow-hidden"
          >
            <div className="p-6 space-y-5">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2.5">
                  <div className="p-1.5 bg-accent/10 rounded-lg">
                    <Trophy className="w-4 h-4 text-accent" />
                  </div>
                  <span className="font-display font-semibold text-ink">{teamData.name}</span>
                </div>
                <div className="text-right">
                  <span className="block text-[10px] text-ink-faint uppercase tracking-wide">Rank</span>
                  <span className="tnum font-semibold text-accent">#{teamRank ?? '—'}</span>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-end">
                  <span className="text-[11px] text-ink-muted uppercase tracking-wide flex items-center gap-1">
                    <Wallet className="w-3 h-3" /> Budget used
                  </span>
                  <span className="tnum text-sm text-ink">
                    {teamData.points_spent} / {teamData.total_budget} VFL
                  </span>
                </div>
                <div className="h-1.5 bg-surface-2 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${budgetProgress}%` }}
                    className="h-full bg-accent rounded-full"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-surface-2 p-4 rounded-xl">
                  <span className="block text-[10px] text-ink-faint uppercase tracking-wide mb-1">Roster</span>
                  <span className="tnum text-xl font-semibold text-ink">{String(rosterSize).padStart(2, '0')}<span className="text-xs text-ink-faint"> / 11</span></span>
                </div>
                <div className="bg-surface-2 p-4 rounded-xl">
                  <span className="block text-[10px] text-ink-faint uppercase tracking-wide mb-1">Available</span>
                  <span className="tnum text-xl font-semibold text-accent">{budgetRemaining}</span>
                </div>
              </div>
            </div>

            <button disabled title="Coming soon" className="w-full py-3.5 bg-surface-2 text-[11px] font-medium uppercase tracking-wide text-ink-faint flex items-center justify-center gap-2 border-t border-border cursor-not-allowed">
              View full roster <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </motion.div>
        )}

        {/* Actions */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="space-y-2"
        >
          {[
            { id: 'edit', label: 'Edit profile', sub: 'Change name and avatar', icon: Settings },
            { id: 'notifications', label: 'Notifications', sub: 'Manage bid alerts', icon: Bell },
            { id: 'history', label: 'Bid history', sub: 'Your past activity', icon: History },
            { id: 'support', label: 'Support', sub: 'FAQ and troubleshooting', icon: HelpCircle },
          ].map((item) => (
            <button
              key={item.id}
              disabled
              title="Coming soon"
              className="w-full flex items-center justify-between p-4 bg-surface border border-border rounded-xl opacity-50 cursor-not-allowed"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-surface-2 text-ink-muted">
                  <item.icon className="w-4 h-4" />
                </div>
                <div className="text-left">
                  <span className="block font-medium text-sm text-ink">{item.label}</span>
                  <span className="block text-xs text-ink-faint">{item.sub}</span>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-ink-faint" />
            </button>
          ))}

          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-between p-4 mt-6 bg-danger/5 hover:bg-danger/10 border border-danger/15 rounded-xl transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-danger/10 text-danger">
                <LogOut className="w-4 h-4" />
              </div>
              <span className="font-medium text-sm text-danger">Log out</span>
            </div>
          </button>
        </motion.div>
      </main>
    </div>
  );
}

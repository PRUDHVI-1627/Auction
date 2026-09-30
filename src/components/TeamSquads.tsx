import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Wallet, Users, Trophy } from 'lucide-react';
import { cn } from '../lib/utils';
import { supabase } from '../lib/supabase';

interface TeamSquadsProps {
  user: any;
}

export default function TeamSquads({ user }: TeamSquadsProps) {
  const [teams, setTeams] = useState<any[]>([]);
  const [players, setPlayers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
    const channel = supabase
      .channel('roster-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'players' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'teams' }, () => fetchData())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  async function fetchData() {
    const { data: teamData } = await supabase.from('teams').select('*').order('name', { ascending: true });
    const { data: playerData } = await supabase.from('players').select('*, teams(name)').eq('status', 'SOLD').order('sold_price', { ascending: false });
    setTeams(teamData || []);
    setPlayers(playerData || []);
    setLoading(false);
  }

  if (loading) return (
    <div className="min-h-screen bg-base flex items-center justify-center">
      <div className="w-6 h-6 border-2 border-border-strong border-t-accent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="min-h-screen bg-base text-ink font-sans pb-28">
      {/* Header */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-accent/[0.03] pattern-diagonal pointer-events-none" />
        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-accent/30 to-transparent" />
        <div className="relative max-w-screen-2xl mx-auto px-5 sm:px-8 pt-8 pb-8">
          <div className="flex items-center gap-2 mb-5">
            <div className="w-7 h-7 rounded-full border-2 border-accent flex items-center justify-center">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="var(--color-accent)"><path d="M12 2L14.09 8.26L20.5 9.27L15.75 13.97L17.18 20.5L12 17.27L6.82 20.5L8.25 13.97L3.5 9.27L9.91 8.26L12 2Z" /></svg>
            </div>
            <span className="font-hype text-base uppercase tracking-wider text-ink-muted">VFL</span>
          </div>
          <h1 className="font-hype text-5xl sm:text-6xl leading-[0.85] tracking-tight uppercase mb-2">
            Team<br/><span className="text-accent">Squads</span>
          </h1>
          <p className="text-ink-muted text-sm">Every roster and budget breakdown.</p>
        </div>
      </div>

      {/* Teams grid */}
      <div className="max-w-screen-2xl mx-auto px-5 sm:px-8 py-6">
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
          {teams.map((team, idx) => {
            const teamPlayers = players.filter(p => p.sold_to_team_id === team.id);
            const budgetUsed = teamPlayers.reduce((sum, p) => sum + (p.sold_price || 0), 0);
            const budgetPct = team.total_budget > 0 ? Math.min(100, (budgetUsed / team.total_budget) * 100) : 0;

            return (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.04, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                key={team.id}
                className="bg-surface rounded-lg border border-border overflow-hidden flex flex-col"
                style={{ maxHeight: 560 }}
              >
                {/* Team color accent bar */}
                <div className="h-1" style={{ background: team.color || 'var(--color-accent)' }} />

                <div className="p-5 border-b border-border flex-shrink-0">
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-3">
                      {team.logo_url ? (
                        <img src={team.logo_url} className="w-10 h-10 rounded-lg border border-border bg-surface-2 object-cover" />
                      ) : (
                        <div className="w-10 h-10 rounded-lg bg-surface-2 border border-border flex items-center justify-center">
                          <Trophy className="w-4 h-4 text-accent" />
                        </div>
                      )}
                      <div>
                        <h2 className="font-display text-lg font-bold text-ink">{team.name}</h2>
                        <p className="text-[10px] text-ink-faint">{teamPlayers.length} players signed</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-[9px] text-ink-faint uppercase tracking-widest">Spent</span>
                      <p className="tnum text-base font-bold text-ink">{budgetUsed}<span className="text-ink-faint font-normal">/{team.total_budget}</span></p>
                    </div>
                  </div>

                  {/* Budget bar */}
                  <div className="mt-3 h-1 bg-surface-2 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-500" style={{ width: `${budgetPct}%`, background: team.color || 'var(--color-accent)' }} />
                  </div>
                </div>

                <div className="p-5 overflow-y-auto flex-1">
                  {teamPlayers.length > 0 ? teamPlayers.map((player) => (
                    <div key={player.id} className="flex justify-between items-center py-2.5 border-b border-border last:border-0">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full overflow-hidden bg-surface-2 border border-border flex-shrink-0">
                          <img src={player.photo_url || 'https://images.unsplash.com/photo-1543326727-cf6c39e8f84c?q=80&w=1470&auto=format&fit=crop'} className="w-full h-full object-cover" referrerPolicy="no-referrer" alt={player.name} />
                        </div>
                        <div>
                          <span className="block text-sm font-medium text-ink">{player.name}</span>
                          <span className="block text-[10px] text-ink-faint">{player.department || player.position} · {player.tier}</span>
                        </div>
                      </div>
                      <span className="tnum text-sm font-bold text-accent">{player.sold_price}</span>
                    </div>
                  )) : (
                    <div className="flex flex-col items-center justify-center py-14">
                      <Users className="w-7 h-7 text-ink-faint mb-3" />
                      <p className="text-xs text-ink-faint">No players signed yet</p>
                    </div>
                  )}
                </div>

                <div className="p-3.5 bg-surface-2 border-t border-border flex items-center gap-2 flex-shrink-0">
                  <Wallet className="w-3.5 h-3.5 text-accent" />
                  <span className="text-[10px] text-ink-muted font-medium">Remaining</span>
                  <span className="tnum text-xs font-bold text-accent ml-auto">{team.total_budget - budgetUsed} VFL</span>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

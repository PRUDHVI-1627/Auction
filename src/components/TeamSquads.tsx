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
    <div className="min-h-screen bg-base pb-28">
      {/* Skeleton header */}
      <div className="bg-surface-2">
        <div className="max-w-screen-2xl mx-auto px-5 sm:px-8 pt-10 pb-10">
          <div className="skeleton w-36 h-4 mb-4" />
          <div className="skeleton w-56 h-14 mb-2" />
          <div className="skeleton w-40 h-10" />
        </div>
      </div>
      <div className="max-w-screen-2xl mx-auto px-5 sm:px-8 py-8">
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="skeleton h-80 rounded-xl" />
          ))}
        </div>
      </div>
    </div>
  );

  const totalSpent = teams.reduce((sum, t) => sum + (t.points_spent || 0), 0);

  return (
    <div className="min-h-screen bg-base text-ink font-sans pb-28">
      {/* === LEAGUE TABLE HEADER — gold accent with grain === */}
      <div className="relative overflow-hidden bg-surface-2 grain">
        <div className="absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: 'radial-gradient(circle at 20% 50%, var(--color-accent) 0%, transparent 50%), radial-gradient(circle at 80% 80%, var(--color-gold) 0%, transparent 50%)'
        }} />
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-accent via-gold to-accent" />

        <div className="relative z-[2] max-w-screen-2xl mx-auto px-5 sm:px-8 pt-10 pb-10">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ type: 'spring', stiffness: 200, damping: 24 }}
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-lg bg-gold/10 border border-gold/20 flex items-center justify-center">
                  <Trophy className="w-5 h-5 text-gold" />
                </div>
                <span className="text-[10px] font-bold uppercase tracking-[0.25em] text-gold">Franchise Rosters</span>
              </div>
              <h1 className="font-hype text-5xl sm:text-6xl md:text-7xl leading-[0.85] tracking-tighter uppercase">
                Team <span className="text-gold">Squads</span>
              </h1>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ type: 'spring', stiffness: 200, damping: 24, delay: 0.05 }}
              className="flex gap-6"
            >
              {[
                { label: 'Franchises', value: teams.length },
                { label: 'Signed', value: players.length },
                { label: 'Total Spent', value: totalSpent, accent: true },
              ].map(s => (
                <div key={s.label} className="text-right">
                  <span className="block text-[9px] font-bold uppercase tracking-widest text-ink-faint">{s.label}</span>
                  <span className={cn("tnum text-2xl font-bold", s.accent ? "text-gold" : "text-ink")}>{s.value}</span>
                </div>
              ))}
            </motion.div>
          </div>
        </div>
      </div>

      {/* === TEAM CARDS — double-bezel === */}
      <div className="max-w-screen-2xl mx-auto px-5 sm:px-8 py-8">
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
          {teams.map((team, idx) => {
            const teamPlayers = players.filter(p => p.sold_to_team_id === team.id);
            const budgetUsed = teamPlayers.reduce((sum, p) => sum + (p.sold_price || 0), 0);
            const budgetPct = team.total_budget > 0 ? Math.min(100, (budgetUsed / team.total_budget) * 100) : 0;
            const remaining = team.total_budget - budgetUsed;

            return (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ type: 'spring', stiffness: 220, damping: 24, delay: idx * 0.04 }}
                key={team.id}
                className="bezel flex flex-col"
                style={{ maxHeight: 560 }}
              >
                <div className="bezel-inner overflow-hidden flex flex-col flex-1">
                  {/* Team-color header with grain */}
                  <div className="relative px-5 py-5 grain" style={{ background: `linear-gradient(135deg, ${team.color || 'var(--color-accent)'}, ${team.color || 'var(--color-accent)'}88)` }}>
                    <div className="absolute inset-0 pattern-diagonal opacity-20 pointer-events-none" />
                    <div className="relative z-[2] flex justify-between items-center">
                      <div className="flex items-center gap-3">
                        {team.logo_url ? (
                          <img src={team.logo_url} className="w-12 h-12 rounded-xl border-2 border-white/20 bg-black/20 object-cover" />
                        ) : (
                          <div className="w-12 h-12 rounded-xl bg-black/20 border-2 border-white/20 flex items-center justify-center">
                            <Trophy className="w-5 h-5 text-white/80" />
                          </div>
                        )}
                        <div>
                          <h2 className="font-hype text-2xl uppercase tracking-wide text-white drop-shadow-sm">{team.name}</h2>
                          <p className="text-[10px] text-white/60 font-semibold">{teamPlayers.length} players signed</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="block tnum text-3xl font-bold text-white drop-shadow-sm">{remaining}</span>
                        <span className="text-[9px] text-white/50 uppercase tracking-widest">VFL left</span>
                      </div>
                    </div>

                    <div className="relative z-[2] mt-4 h-2 bg-black/20 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${budgetPct}%` }}
                        transition={{ type: 'spring', stiffness: 100, damping: 20, delay: idx * 0.04 + 0.2 }}
                        className="h-full rounded-full bg-white/40"
                      />
                    </div>
                    <div className="relative z-[2] flex justify-between mt-1.5">
                      <span className="text-[9px] text-white/40 font-semibold">Spent {budgetUsed}</span>
                      <span className="text-[9px] text-white/40 font-semibold">Budget {team.total_budget}</span>
                    </div>
                  </div>

                  {/* Player list */}
                  <div className="p-4 overflow-y-auto flex-1">
                    {teamPlayers.length > 0 ? (
                      <div className="space-y-0">
                        <div className="grid grid-cols-12 gap-2 px-2 pb-2 border-b border-border mb-1">
                          <span className="col-span-1 text-[8px] uppercase tracking-widest text-ink-faint">#</span>
                          <span className="col-span-7 text-[8px] uppercase tracking-widest text-ink-faint">Player</span>
                          <span className="col-span-2 text-[8px] uppercase tracking-widest text-ink-faint text-center">Pos</span>
                          <span className="col-span-2 text-[8px] uppercase tracking-widest text-ink-faint text-right">Price</span>
                        </div>
                        {teamPlayers.map((player, pIdx) => (
                          <div key={player.id} className="grid grid-cols-12 gap-2 items-center px-2 py-2.5 border-b border-border/50 last:border-0 hover:bg-surface-3/40 transition-colors rounded">
                            <span className="col-span-1 tnum text-[10px] text-ink-faint font-bold">{pIdx + 1}</span>
                            <div className="col-span-7 flex items-center gap-2.5">
                              <div className="w-7 h-7 rounded-full overflow-hidden bg-surface-2 border border-border flex-shrink-0">
                                <img src={player.photo_url || 'https://images.unsplash.com/photo-1543326727-cf6c39e8f84c?q=80&w=1470&auto=format&fit=crop'} className="w-full h-full object-cover" referrerPolicy="no-referrer" alt={player.name} />
                              </div>
                              <div>
                                <span className="block text-sm font-medium text-ink leading-tight">{player.name}</span>
                                <span className="block text-[9px] text-ink-faint">{player.tier}</span>
                              </div>
                            </div>
                            <span className="col-span-2 text-[10px] text-ink-muted font-semibold text-center uppercase">{(player.department || player.position || '—').slice(0, 3)}</span>
                            <span className="col-span-2 tnum text-sm font-bold text-right" style={{ color: team.color || 'var(--color-accent)' }}>{player.sold_price}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center py-14 gap-3">
                        <div className="w-12 h-12 rounded-xl bg-surface-3 flex items-center justify-center">
                          <Users className="w-6 h-6 text-ink-faint" />
                        </div>
                        <p className="text-xs text-ink-faint">No players signed yet</p>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

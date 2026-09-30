import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Wallet, Users, Trophy } from 'lucide-react';
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

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  async function fetchData() {
    const { data: teamData } = await supabase
      .from('teams')
      .select('*')
      .order('name', { ascending: true });

    const { data: playerData } = await supabase
      .from('players')
      .select('*, teams(name)')
      .eq('status', 'SOLD')
      .order('sold_price', { ascending: false });

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
    <div className="min-h-screen bg-base text-ink font-sans">
      <header className="bg-base/95 backdrop-blur-sm sticky top-0 z-50 border-b border-border">
        <div className="flex items-center w-full px-6 py-4 max-w-screen-2xl mx-auto">
          <span className="font-display font-semibold text-sm text-ink-muted">Roster review</span>
        </div>
      </header>

      <main className="max-w-screen-2xl mx-auto px-6 py-10 pb-32">
        <div className="mb-10">
          <h1 className="font-display text-3xl md:text-4xl font-bold tracking-tight text-ink mb-1">Final squads</h1>
          <p className="text-ink-muted text-sm">Every roster and how much of the budget went into it.</p>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {teams.map((team, idx) => {
            const teamPlayers = players.filter(p => p.sold_to_team_id === team.id);
            const budgetUsed = teamPlayers.reduce((sum, p) => sum + (p.sold_price || 0), 0);

            return (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                key={team.id}
                className="bg-surface rounded-2xl border border-border overflow-hidden flex flex-col h-[560px]"
              >
                <div className="p-6 border-b border-border flex-shrink-0">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="flex items-center gap-2">
                        <Trophy className="w-4 h-4 text-accent" />
                        <h2 className="font-display text-xl font-semibold text-ink">{team.name}</h2>
                      </div>
                      <p className="text-[11px] text-ink-faint mt-1">Squad size: {teamPlayers.length} / 11</p>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-ink-faint uppercase tracking-wide">Spent</span>
                      <p className="tnum text-lg font-semibold text-ink">{budgetUsed} / {team.total_budget}</p>
                    </div>
                  </div>
                </div>

                <div className="p-6 overflow-y-auto flex-1">
                  <div className="space-y-1">
                    {teamPlayers.length > 0 ? teamPlayers.map((player) => (
                      <div key={player.id} className="flex justify-between items-center py-2.5 border-b border-border last:border-0">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full overflow-hidden bg-surface-2 border border-border">
                            <img src={player.photo_url || 'https://images.unsplash.com/photo-1543326727-cf6c39e8f84c?q=80&w=1470&auto=format&fit=crop'} className="w-full h-full object-cover" referrerPolicy="no-referrer" alt={player.name} />
                          </div>
                          <div>
                            <span className="block text-sm text-ink">{player.name}</span>
                            <span className="block text-[10px] text-ink-faint">{player.department || player.position} · {player.tier}</span>
                          </div>
                        </div>
                        <span className="tnum text-sm text-accent">{player.sold_price}</span>
                      </div>
                    )) : (
                      <div className="flex flex-col items-center justify-center py-16 border border-dashed border-border rounded-xl">
                        <Users className="w-8 h-8 text-ink-faint mb-3" />
                        <p className="text-xs text-ink-faint text-center px-8">No players signed in this pool yet</p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="p-4 bg-surface-2 border-t border-border flex items-center gap-2 flex-shrink-0">
                  <Wallet className="w-3.5 h-3.5 text-accent" />
                  <span className="text-xs text-ink-muted">Remaining</span>
                  <span className="tnum text-xs text-accent ml-auto">{team.total_budget - budgetUsed} VFL</span>
                </div>
              </motion.div>
            );
          })}
        </div>
      </main>
    </div>
  );
}

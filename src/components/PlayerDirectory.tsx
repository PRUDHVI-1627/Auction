import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Search } from 'lucide-react';
import type { Player } from '../types';
import { cn } from '../lib/utils';
import { supabase } from '../lib/supabase';

interface PlayerDirectoryProps {
  user: any;
}

export default function PlayerDirectory({ user }: PlayerDirectoryProps) {
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [activePosition, setActivePosition] = useState('All');
  const [activeStatus, setActiveStatus] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchPlayers();
    const channel = supabase
      .channel('players-all')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'players' }, () => fetchPlayers())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'teams' }, () => fetchPlayers())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  async function fetchPlayers() {
    const { data } = await supabase
      .from('players')
      .select('*, sold_to:teams(name, color, logo_url)')
      .order('queue_order', { ascending: true });
    if (data) setPlayers(data as any);
    setLoading(false);
  }

  const filteredPlayers = players.filter(p => {
    const matchesPos = activePosition === 'All' ||
      p.position === activePosition ||
      (p.position && p.position.includes(activePosition)) ||
      (p.department && p.department.includes(activePosition));
    const matchesStatus = activeStatus === 'ALL' || p.status === activeStatus;
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesPos && matchesStatus && matchesSearch;
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-base flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-border-strong border-t-accent rounded-full animate-spin" />
      </div>
    );
  }

  const soldCount = players.filter(p => p.status === 'SOLD').length;
  const liveCount = players.filter(p => p.status === 'LIVE').length;
  const upcomingCount = players.filter(p => p.status === 'UPCOMING').length;

  return (
    <div className="min-h-screen bg-base text-ink font-sans pb-28">
      {/* === BOLD ACCENT HERO === */}
      <div className="relative bg-accent clip-slant-br">
        <div className="absolute inset-0 pattern-diagonal opacity-30 pointer-events-none" />
        <div className="relative max-w-screen-2xl mx-auto px-5 sm:px-8 pt-10 pb-16">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          >
            <span className="inline-block text-[10px] font-bold uppercase tracking-[0.25em] text-white/60 mb-3">VFL Draft Pool</span>
            <h1 className="font-hype text-6xl sm:text-7xl md:text-8xl leading-[0.85] tracking-tight uppercase text-white">
              Player<br />Directory
            </h1>
          </motion.div>
        </div>
      </div>

      {/* === SCOREBOARD STATS BAR === */}
      <div className="relative -mt-8 z-10 max-w-screen-2xl mx-auto px-5 sm:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="bg-surface-2 border border-border rounded-xl overflow-hidden scoreboard-shimmer"
        >
          <div className="grid grid-cols-4 divide-x divide-border">
            {[
              { label: 'Total Pool', value: players.length, color: 'text-ink' },
              { label: 'Sold', value: soldCount, color: 'text-success' },
              { label: 'Live Now', value: liveCount, color: 'text-danger' },
              { label: 'Upcoming', value: upcomingCount, color: 'text-ink-muted' },
            ].map((stat) => (
              <div key={stat.label} className="px-4 py-4 sm:px-6 sm:py-5 text-center">
                <span className="block text-[9px] sm:text-[10px] font-bold uppercase tracking-widest text-ink-faint mb-1">{stat.label}</span>
                <span className={cn("tnum text-2xl sm:text-4xl font-bold leading-none", stat.color)}>
                  {stat.value}
                </span>
                {stat.label === 'Live Now' && liveCount > 0 && (
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-danger live-dot ml-1.5 -translate-y-3" />
                )}
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* === SEARCH + FILTERS === */}
      <div className="max-w-screen-2xl mx-auto px-5 sm:px-8 pt-8 pb-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-0 bg-surface-2 rounded-lg p-1 border border-border">
            {['All', 'GK', 'DEF', 'MID', 'FWD'].map(pos => (
              <button
                key={pos}
                onClick={() => setActivePosition(pos)}
                className={cn(
                  "px-4 py-2 text-xs font-bold rounded-md transition-all uppercase tracking-wider",
                  activePosition === pos
                    ? "bg-accent text-white shadow-sm"
                    : "text-ink-faint hover:text-ink"
                )}
              >
                {pos}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <div className="flex gap-1">
              {[
                { id: 'ALL', color: '' },
                { id: 'UPCOMING', color: '' },
                { id: 'LIVE', color: 'danger' },
                { id: 'SOLD', color: 'success' },
                { id: 'UNSOLD', color: '' },
              ].map(s => (
                <button
                  key={s.id}
                  onClick={() => setActiveStatus(s.id)}
                  className={cn(
                    "px-2.5 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-widest transition-all",
                    activeStatus === s.id
                      ? s.color === 'danger' ? "bg-danger text-white"
                        : s.color === 'success' ? "bg-success text-black"
                        : "bg-ink/15 text-ink"
                      : "text-ink-faint hover:text-ink-muted"
                  )}
                >
                  {s.id}
                </button>
              ))}
            </div>

            <div className="relative flex-1 sm:w-56">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-faint" />
              <input
                className="w-full h-9 bg-surface border border-border focus:border-accent rounded-lg pl-9 pr-4 text-sm text-ink placeholder:text-ink-faint outline-none transition-colors"
                placeholder="Search..."
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
        </div>
      </div>

      {/* === CARD GRID === */}
      <div className="max-w-screen-2xl mx-auto px-5 sm:px-8">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {filteredPlayers.map((player, index) => (
            <PlayerCard key={player.id} player={player} index={index} />
          ))}
        </div>

        {filteredPlayers.length === 0 && !loading && (
          <div className="text-center py-24">
            <p className="font-hype text-3xl text-ink-muted uppercase mb-2">No players found</p>
            <p className="text-ink-faint text-sm">Adjust your filters or search term.</p>
          </div>
        )}
      </div>
    </div>
  );
}

const TIER_COLOR: Record<string, string> = {
  GOLD: '#ffd600',
  SILVER: '#90a4ae',
  BRONZE: '#bf6b2a',
};

function PlayerCard({ player, index = 0 }: { player: any; index?: number; key?: string | number }) {
  const teamColor = player.sold_to?.color || TIER_COLOR[player.tier] || '#2979ff';
  const price = player.status === 'SOLD' ? player.sold_price : player.base_price;
  const isSold = player.status === 'SOLD';
  const isLive = player.status === 'LIVE';

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: Math.min(index, 20) * 0.025, ease: [0.16, 1, 0.3, 1] }}
      whileHover={!isSold ? { y: -3, transition: { type: 'spring', stiffness: 400, damping: 26 } } : {}}
      className={cn(
        "group relative overflow-hidden rounded-lg",
        isSold && 'opacity-65'
      )}
      style={{ backgroundColor: teamColor }}
    >
      <div className="aspect-[3/4] relative overflow-hidden">
        <img
          alt={player.name}
          className="absolute inset-y-0 left-[14%] w-[72%] h-full object-cover object-top grayscale-[0.1] group-hover:grayscale-0 transition-all duration-500 drop-shadow-[0_6px_16px_rgba(0,0,0,0.5)]"
          src={player.photo_url || 'https://images.unsplash.com/photo-1543326727-cf6c39e8f84c?q=80&w=1470&auto=format&fit=crop'}
          referrerPolicy="no-referrer"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-black/20" />

        <div className="absolute top-2.5 left-2.5 right-2.5 flex items-start justify-between">
          {player.sold_to?.logo_url ? (
            <img src={player.sold_to.logo_url} className="w-7 h-7 rounded object-cover border border-white/20 bg-black/40" />
          ) : (
            <div className="w-7 h-7 rounded flex items-center justify-center bg-black/40 border border-white/10">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: teamColor }} />
            </div>
          )}
          <div className="text-right bg-black/40 backdrop-blur-sm rounded px-2 py-1">
            <div className="tnum text-lg font-bold text-white leading-none">{price}</div>
            <div className="text-[8px] uppercase tracking-wider text-white/50 mt-0.5">VFL</div>
          </div>
        </div>

        {isLive && (
          <div className="absolute top-2.5 left-1/2 -translate-x-1/2 flex items-center gap-1.5 bg-danger/90 backdrop-blur-sm px-2.5 py-1 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-white live-dot" />
            <span className="text-[9px] font-bold uppercase tracking-widest text-white">Live</span>
          </div>
        )}

        {isSold && (
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 -rotate-12">
            <div className="border-2 border-white/60 text-white px-5 py-1.5 rounded font-hype text-base uppercase tracking-widest bg-black/40 backdrop-blur-sm">
              Sold
            </div>
          </div>
        )}

        <div className="absolute bottom-0 left-0 right-0">
          <div className="px-2.5 pb-1">
            <h3 className="font-hype text-[15px] uppercase leading-tight text-white truncate">{player.name}</h3>
            <p className="text-[9px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: teamColor, filter: 'brightness(1.5)' }}>
              {player.position}{isSold && player.sold_to?.name ? ` · ${player.sold_to.name}` : ''}
            </p>
          </div>
          <div className="grid grid-cols-4 border-t border-white/10 bg-black/60 backdrop-blur-sm">
            {[
              { l: 'Tier', v: player.tier?.slice(0, 3) },
              { l: 'Year', v: player.year || '—' },
              { l: 'Dept', v: (player.department || '—').slice(0, 4) },
              { l: 'Stat', v: player.status?.slice(0, 4) },
            ].map((s) => (
              <div key={s.l} className="px-1 py-1.5 text-center border-r border-white/5 last:border-r-0">
                <div className="text-[7px] uppercase tracking-wider text-white/40 leading-none mb-0.5">{s.l}</div>
                <div className="text-[9px] font-bold text-white leading-none truncate">{s.v}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

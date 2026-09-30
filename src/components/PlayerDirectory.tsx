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
  const [activePosition, setActivePosition] = useState('All Positions');
  const [activeStatus, setActiveStatus] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchPlayers();

    const channel = supabase
      .channel('players-all')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'players' }, () => {
        fetchPlayers();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'teams' }, () => {
        fetchPlayers();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
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
    const matchesPos = activePosition === 'All Positions' ||
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

  return (
    <div className="min-h-screen bg-base text-ink font-sans">
      <header className="bg-base/95 backdrop-blur-sm sticky top-0 z-50 border-b border-border">
        <div className="flex items-center gap-2.5 w-full px-6 py-4 max-w-screen-2xl mx-auto">
          <svg width="24" height="24" viewBox="0 0 32 32" fill="none">
            <circle cx="16" cy="16" r="15" stroke="var(--color-accent)" strokeWidth="1.5" />
            <path d="M16 8L17.85 13.54H23.7L18.93 16.96L20.78 22.5L16 19.08L11.22 22.5L13.07 16.96L8.3 13.54H14.15L16 8Z" fill="var(--color-accent)" />
          </svg>
          <span className="font-display font-semibold text-sm text-ink-muted">Vedam Football League</span>
        </div>
      </header>

      <main className="max-w-screen-2xl mx-auto px-6 py-10 pb-32">
        <section className="mb-10">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div>
              <h1 className="font-display text-4xl md:text-5xl font-bold tracking-tight text-ink mb-2">
                Player Directory
              </h1>
              <p className="text-ink-muted text-sm">Scout the pool before you enter the arena.</p>
            </div>
            <div className="w-full md:w-80">
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-faint" />
                <input
                  className="w-full h-11 bg-surface border border-border focus:border-accent rounded-lg pl-10 pr-4 text-sm text-ink placeholder:text-ink-faint outline-none transition-colors"
                  placeholder="Search players"
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
          </div>
        </section>

        <section className="flex flex-wrap items-center justify-between gap-4 mb-8">
          <div className="flex flex-wrap gap-1.5">
            {[
              { id: 'All Positions', label: 'All' },
              { id: 'GK', label: 'Goalkeeper' },
              { id: 'DEF', label: 'Defender' },
              { id: 'MID', label: 'Midfield' },
              { id: 'FWD', label: 'Forward' }
            ].map(pos => (
              <button
                key={pos.id}
                onClick={() => setActivePosition(pos.id)}
                className={cn(
                  "px-4 py-2 text-xs font-medium rounded-lg transition-colors",
                  activePosition === pos.id ? "bg-accent text-accent-ink" : "bg-surface text-ink-muted hover:text-ink border border-border"
                )}
              >
                {pos.label}
              </button>
            ))}
          </div>
          <div className="flex gap-1.5">
            {['ALL', 'UPCOMING', 'LIVE', 'SOLD', 'UNSOLD'].map((status) => (
              <button
                key={status}
                onClick={() => setActiveStatus(status)}
                className={cn(
                  "px-3.5 py-2 rounded-lg text-[11px] font-medium uppercase tracking-wide transition-colors border",
                  activeStatus === status
                    ? "bg-ink text-base border-ink"
                    : "bg-transparent text-ink-faint border-border hover:text-ink-muted"
                )}
              >
                {status}
              </button>
            ))}
          </div>
        </section>

        <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {filteredPlayers.map((player, index) => (
            <PlayerCard key={player.id} player={player} index={index} />
          ))}
        </section>
        {filteredPlayers.length === 0 && !loading && (
          <div className="text-center py-24 col-span-full">
            <p className="font-display font-semibold text-xl text-ink-muted mb-1">No players found</p>
            <p className="text-ink-faint text-sm">Try adjusting your filters or search term.</p>
          </div>
        )}
      </main>
    </div>
  );
}

const TIER_COLOR: Record<string, string> = {
  GOLD: '#d4af6a',
  SILVER: '#a9b3cf',
  BRONZE: '#b3713f',
};

function PlayerCard({ player, index = 0 }: { player: any; index?: number; key?: string | number }) {
  const accentColor = player.sold_to?.color || TIER_COLOR[player.tier] || '#2f5fff';
  const headlineValue = player.status === 'SOLD' ? player.sold_price : player.base_price;
  const isSold = player.status === 'SOLD';

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: Math.min(index, 20) * 0.03, ease: [0.16, 1, 0.3, 1] }}
      whileHover={!isSold ? { y: -4, transition: { type: 'spring', stiffness: 300, damping: 24 } } : {}}
      layout
      className={cn(
        "group relative overflow-hidden rounded-xl border border-border",
        isSold && 'opacity-70'
      )}
      style={{ backgroundColor: accentColor }}
    >
      <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/50" />

      <div className="aspect-[3/4] relative overflow-hidden">
        <img
          alt={player.name}
          className="absolute inset-y-0 left-[16%] w-[68%] h-full object-cover object-top grayscale-[0.15] group-hover:grayscale-0 transition-all duration-500 drop-shadow-[0_8px_20px_rgba(0,0,0,0.5)]"
          src={player.photo_url || 'https://images.unsplash.com/photo-1543326727-cf6c39e8f84c?q=80&w=1470&auto=format&fit=crop'}
          referrerPolicy="no-referrer"
        />

        <div className="absolute inset-0 bg-gradient-to-t from-base via-base/20 to-transparent" />

        {/* Top row: team badge + headline number */}
        <div className="absolute top-3 left-3 right-3 flex items-start justify-between">
          {player.sold_to?.logo_url ? (
            <img src={player.sold_to.logo_url} className="w-7 h-7 rounded object-cover border border-white/10 bg-base/60" />
          ) : (
            <div className="w-7 h-7 rounded flex items-center justify-center bg-base/60 border border-white/10">
              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: accentColor }} />
            </div>
          )}
          <div className="text-right">
            <div className="tnum text-xl font-bold text-ink leading-none">{headlineValue}</div>
            <div className="text-[9px] uppercase tracking-wide text-ink-faint mt-0.5">VFL</div>
          </div>
        </div>

        {isSold && (
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 border-2 border-ink/60 text-ink px-4 py-1.5 rounded font-hype text-sm uppercase tracking-widest bg-base/60 backdrop-blur-sm">
            Sold
          </div>
        )}

        {/* Bottom: name, position, stat footer */}
        <div className="absolute bottom-0 left-0 right-0">
          {player.status === 'LIVE' && (
            <div className="flex items-center gap-1.5 px-3 mb-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-danger animate-pulse" />
              <span className="text-[10px] uppercase font-medium tracking-wide text-danger">Bidding now</span>
            </div>
          )}
          <div className="px-3">
            <h3 className="font-display text-base font-bold uppercase leading-tight text-ink truncate">{player.name}</h3>
            <p className="text-[10px] font-medium uppercase tracking-wide mb-2" style={{ color: accentColor }}>
              {player.position}{isSold && player.sold_to?.name ? ` · ${player.sold_to.name}` : ''}
            </p>
          </div>
          <div className="grid grid-cols-4 border-t border-white/10 bg-base/70 backdrop-blur-sm">
            {[
              { label: 'Tier', value: player.tier?.slice(0, 3) },
              { label: 'Year', value: player.year || '—' },
              { label: 'Dept', value: (player.department || '—').slice(0, 4) },
              { label: 'Status', value: player.status?.slice(0, 4) },
            ].map((s) => (
              <div key={s.label} className="px-1.5 py-2 text-center border-r border-white/5 last:border-r-0">
                <div className="text-[8px] uppercase tracking-wide text-ink-faint leading-none mb-1">{s.label}</div>
                <div className="text-[10px] font-semibold text-ink leading-none truncate">{s.value}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

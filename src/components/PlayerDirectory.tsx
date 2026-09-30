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
      .select('*, sold_to:teams(name)')
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
      <div className="min-h-screen bg-surface flex items-center justify-center text-primary font-black animate-pulse uppercase tracking-[0.4em]">
        Loading Players
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface text-white font-body selection:bg-primary selection:text-surface">
      <header className="bg-black/80 backdrop-blur-xl sticky top-0 z-50 border-b border-white/5">
        <div className="flex justify-between items-center w-full px-6 py-4 max-w-screen-2xl mx-auto">
          <h1 className="font-headline font-black italic tracking-tighter text-3xl md:text-5xl lg:text-6xl text-white uppercase leading-none drop-shadow-2xl">
            Vedam Football League
          </h1>
        </div>
      </header>

      <main className="max-w-screen-2xl mx-auto px-6 py-8 pb-32">
        <section className="mb-12">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div>
              <h1 className="font-headline text-5xl md:text-7xl font-black tracking-tighter uppercase text-white mb-2">
                Player <span className="text-primary italic">Directory</span>
              </h1>
              <p className="font-label text-white/40 uppercase tracking-widest">Scout your next legend in the arena</p>
            </div>
            <div className="w-full md:w-96">
              <div className="relative group">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40 group-focus-within:text-primary transition-colors w-5 h-5" />
                <input 
                  className="w-full bg-surface-container-low border-none ring-1 ring-white/10 focus:ring-2 focus:ring-primary py-4 pl-12 pr-4 text-white font-label tracking-wide rounded-lg placeholder:text-white/20 transition-all" 
                  placeholder="Search player name or ID..." 
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 lg:grid-cols-12 gap-4 mb-10">
          <div className="lg:col-span-7 flex flex-wrap gap-2">
            <button 
              onClick={() => setActivePosition('All Positions')}
              className={cn("px-6 py-3 font-label font-bold uppercase text-xs tracking-widest rounded-lg transition-all", activePosition === 'All Positions' ? "bg-primary text-surface shadow-[0_0_15px_rgba(255,231,146,0.3)]" : "bg-surface-container-high hover:bg-surface-bright text-white/60")}
            >All Positions</button>
            {[
              { id: 'GK', label: 'Goalkeeper' },
              { id: 'DEF', label: 'Defender' },
              { id: 'MID', label: 'Midfield' },
              { id: 'FWD', label: 'Forward' }
            ].map(pos => (
              <button 
                key={pos.id} 
                onClick={() => setActivePosition(pos.id)}
                className={cn("px-6 py-3 font-label font-bold uppercase text-xs tracking-widest rounded-lg transition-all", activePosition === pos.id ? "bg-primary text-surface shadow-[0_0_15px_rgba(255,231,146,0.3)]" : "bg-surface-container-high hover:bg-surface-bright text-white/60")}
              >
                {pos.label}
              </button>
            ))}
          </div>
          <div className="lg:col-span-5 flex flex-wrap justify-end gap-2">
            <div className="flex gap-4 overflow-x-auto pb-4 no-scrollbar">
              {['ALL', 'UPCOMING', 'LIVE', 'SOLD', 'UNSOLD'].map((status) => (
                <button
                  key={status}
                  onClick={() => setActiveStatus(status)}
                  className={cn(
                    "px-6 py-2.5 rounded-full text-[10px] font-black tracking-[0.2em] transition-all border uppercase whitespace-nowrap",
                    activeStatus === status
                      ? "bg-primary text-surface border-primary shadow-[0_0_20px_rgba(212,175,55,0.3)]"
                      : "bg-white/5 text-white/40 border-white/10 hover:border-white/20"
                  )}
                >
                  {status}
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
          {filteredPlayers.map(player => (
            <PlayerCard key={player.id} player={player} />
          ))}
        </section>
        {filteredPlayers.length === 0 && !loading && (
          <div className="text-center py-24 col-span-full">
            <p className="font-headline font-black italic uppercase text-4xl text-white/10 tracking-tighter mb-2">No Players Found</p>
            <p className="font-label text-xs text-white/20 uppercase tracking-widest">Try adjusting your filters or search term</p>
          </div>
        )}
      </main>
    </div>
  );
}

function PlayerCard({ player }: { player: any; key?: string | number }) {
  const tierClass = player.tier === 'GOLD' ? 'tier-gold-glow' : player.tier === 'SILVER' ? 'tier-silver-glow' : 'tier-bronze-glow';
  const tierColor = player.tier === 'GOLD' ? 'bg-[#ffd700] text-surface' : player.tier === 'SILVER' ? 'bg-[#e0e0e0] text-surface' : 'bg-[#a0522d] text-white';
  const gleamColor = player.tier === 'GOLD' ? '#ffd700' : player.tier === 'SILVER' ? '#e0e0e0' : '#a0522d';

  return (
    <motion.div 
      whileHover={player.status !== 'SOLD' ? { scale: 1.05, y: -12 } : { scale: 1.02 }}
      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
      layout
      className={cn(
        "group relative overflow-hidden bg-surface-container-highest rounded-xl cursor-pointer card-hover-gleam", 
        tierClass,
        player.status === 'SOLD' && 'grayscale-[0.5]'
      )}
      style={{ '--gleam-color': gleamColor } as any}
    >
      {(player.tier === 'GOLD' || player.tier === 'SILVER' || player.tier === 'BRONZE') && <div className="metallic-shine" />}
      <div className="aspect-[3/4] relative overflow-hidden">
        <img 
          alt={player.name} 
          className="w-full h-full object-cover grayscale-[0.2] group-hover:grayscale-0 transition-all duration-500" 
          src={player.photo_url || 'https://images.unsplash.com/photo-1543326727-cf6c39e8f84c?q=80&w=1470&auto=format&fit=crop'}
          referrerPolicy="no-referrer"
        />
        
        {player.status === 'SOLD' && (
          <div className="sold-stamp">SOLD</div>
        )}

        <div className="absolute inset-0 player-card-gradient"></div>
        <div className="absolute top-4 left-4 flex flex-col gap-1">
          <div className={cn("px-2 py-1 text-[10px] font-bold font-label tracking-widest rounded", tierColor)}>
            {player.tier === 'GOLD' ? '7' : player.tier === 'SILVER' ? '5' : '3'} PTS
          </div>
          <div className="bg-black/80 backdrop-blur-md px-2 py-1 text-[10px] font-bold font-label tracking-widest rounded">{player.position}</div>
        </div>
        <div className="absolute bottom-4 left-4 right-4">
          <div className="flex items-center gap-2 mb-1">
            {player.status === 'LIVE' && <span className="w-2 h-2 rounded-full bg-error animate-pulse"></span>}
            <span className={cn("font-label text-[10px] uppercase font-bold tracking-widest", player.status === 'LIVE' ? 'text-error' : 'text-white/40')}>
              {player.status === 'SOLD' ? (
                <span className="text-primary">Sold to {player.sold_to?.name || 'Unknown Team'}</span>
              ) : player.status === 'LIVE' ? (
                'Currently Bidding'
              ) : player.status === 'UPCOMING' ? (
                'Upcoming'
              ) : 'Unsold'}
            </span>
          </div>
          <h3 className="font-headline text-2xl font-black uppercase tracking-tighter leading-none mb-1">{player.name}</h3>
          <div className="flex justify-between items-end border-t border-white/10 pt-2 mt-2">
            <div className="font-label text-xs text-white/40 uppercase tracking-widest">
              {player.status === 'SOLD' ? 'Price' : 'Starting'}
            </div>
            <div className={cn("font-label text-xl font-bold", player.status === 'SOLD' ? 'text-white' : 'text-primary')}>
              {player.status === 'SOLD' ? player.sold_price : player.base_price} <span className="text-[10px]">VFL</span>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

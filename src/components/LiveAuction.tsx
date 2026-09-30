import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Wallet, Plus, AlertTriangle, X, Users, Trophy } from 'lucide-react';
import { cn } from '../lib/utils';
import { supabase } from '../lib/supabase';

interface LiveAuctionProps {
  user: any;
}

export default function LiveAuction({ user }: LiveAuctionProps) {
  const [session, setSession] = useState<any>(null);
  const [activePlayer, setActivePlayer] = useState<any>(null);
  const [bids, setBids] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isBidding, setIsBidding] = useState(false);
  const [outbidToast, setOutbidToast] = useState(false);
  const [userTeamId, setUserTeamId] = useState<string | null>(null);
  const [userTeam, setUserTeam] = useState<any>(null);
  const [finishedPlayers, setFinishedPlayers] = useState<any[]>([]);
  const [upcomingPlayers, setUpcomingPlayers] = useState<any[]>([]);
  const [teamSquad, setTeamSquad] = useState<any[]>([]);
  const [allTeams, setAllTeams] = useState<any[]>([]);
  const [sellAnimation, setSellAnimation] = useState<{player: any, type: 'SOLD' | 'UNSOLD'} | null>(null);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const activePlayerRef = useRef<any>(null);

  useEffect(() => { activePlayerRef.current = activePlayer; }, [activePlayer]);

  useEffect(() => {
    initAuction();
    const sessionSub = supabase
      .channel('live-auction')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'auction_session' }, (payload: any) => {
        setSession(payload.new);
        if (payload.new.current_player_id) {
          fetchPlayer(payload.new.current_player_id);
          fetchBids(payload.new.current_player_id);
        } else {
          setActivePlayer(null);
          setBids([]);
        }
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'bids' }, async (payload: any) => {
        fetchBids(payload.new.player_id);
        if (user && userTeamId && payload.new.team_id !== userTeamId) {
          const { data: prevBid } = await supabase
            .from('bids').select('team_id')
            .eq('player_id', payload.new.player_id).eq('is_undone', false)
            .order('created_at', { ascending: false }).range(1, 1).maybeSingle();
          if (prevBid?.team_id === userTeamId) {
            setOutbidToast(true);
            setTimeout(() => setOutbidToast(false), 5000);
          }
        }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'players' }, async (payload: any) => {
        if (payload.new.status === 'SOLD' || payload.new.status === 'UNSOLD') {
          setTimeout(async () => {
            fetchFinished(); fetchUpcoming(); fetchAllTeams();
            if (userTeamId) {
              fetchTeamSquad(userTeamId);
              const { data: updatedTeam } = await supabase.from('teams').select('*').eq('id', userTeamId).maybeSingle();
              setUserTeam(updatedTeam);
            }
          }, 500);
          setSellAnimation({ player: payload.new, type: payload.new.status });
          setTimeout(() => setSellAnimation(null), 4000);
        }
        if (activePlayerRef.current && payload.new.id === activePlayerRef.current.id) {
          setActivePlayer(payload.new);
        }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'teams' }, (payload: any) => {
        if (userTeamId && payload.new.id === userTeamId) {
          setUserTeam(payload.new); fetchTeamSquad(userTeamId);
        }
        fetchAllTeams();
      })
      .subscribe();
    return () => { supabase.removeChannel(sessionSub); };
  }, [user, userTeamId]);

  useEffect(() => {
    if (!session?.timer_expires_at || session?.status !== 'LIVE') { setTimeLeft(null); return; }
    const timer = setInterval(() => {
      const diff = Math.max(0, Math.floor((new Date(session.timer_expires_at).getTime() - Date.now()) / 1000));
      setTimeLeft(diff);
      if (diff === 0) clearInterval(timer);
    }, 1000);
    return () => clearInterval(timer);
  }, [session?.timer_expires_at, session?.status]);

  async function fetchFinished() {
    const { data } = await supabase.from('players').select('*, teams(*)').or('status.eq.SOLD,status.eq.UNSOLD').order('updated_at', { ascending: false });
    setFinishedPlayers(data || []);
  }
  async function fetchUpcoming() {
    const { data } = await supabase.from('players').select('*').eq('status', 'UPCOMING').order('queue_order', { ascending: true }).limit(3);
    setUpcomingPlayers(data || []);
  }
  async function fetchTeamSquad(teamId: string) {
    const { data } = await supabase.from('players').select('*').eq('sold_to_team_id', teamId);
    setTeamSquad(data || []);
  }
  async function fetchAllTeams() {
    const { data } = await supabase.from('teams').select('*').order('name', { ascending: true });
    setAllTeams(data || []);
  }
  async function initAuction() {
    const { data: { user } } = await supabase.auth.getUser();
    const { data: sess } = await supabase.from('auction_session').select('*').single();
    let teamId = null; let team = null;
    if (user) {
      const { data: profile } = await supabase.from('users').select('id, team_id').eq('id', user.id).maybeSingle();
      if (profile?.team_id) {
        teamId = profile.team_id;
        const { data: teamData } = await supabase.from('teams').select('*').eq('id', teamId).maybeSingle();
        team = teamData;
      }
    }
    setSession(sess); setUserTeamId(teamId); setUserTeam(team);
    if (sess?.current_player_id) { fetchPlayer(sess.current_player_id); fetchBids(sess.current_player_id); }
    fetchFinished(); fetchUpcoming(); fetchAllTeams();
    if (teamId) fetchTeamSquad(teamId);
    setLoading(false);
  }
  async function fetchPlayer(id: string) {
    const { data } = await supabase.from('players').select('*').eq('id', id).single();
    setActivePlayer(data);
  }
  async function fetchBids(playerId: string) {
    if (!playerId) return;
    const { data } = await supabase.from('bids').select('*, teams(name)').eq('player_id', playerId).eq('is_undone', false).order('created_at', { ascending: false });
    setBids(data || []);
  }
  async function handleBid(increment: number) {
    if (!activePlayer || isBidding || session?.status !== 'LIVE') return;
    let effectiveTeamId = userTeamId; let effectiveTeam = userTeam;
    if (user && (!effectiveTeamId || !effectiveTeam)) {
      const { data: profile } = await supabase.from('users').select('id, team_id, role').ilike('email', user.email || '').maybeSingle();
      if (profile) {
        effectiveTeamId = profile.team_id;
        if (effectiveTeamId) {
          const { data: teamData } = await supabase.from('teams').select('*').eq('id', effectiveTeamId).maybeSingle();
          effectiveTeam = teamData;
        }
        setUserTeamId(effectiveTeamId); setUserTeam(effectiveTeam);
      }
    }
    if (!user) { alert("Please login to place bids"); return; }
    if (!effectiveTeamId) { alert("No team assigned! Admin must assign " + user.email + " to a team first."); return; }
    if (!effectiveTeam) { alert("Error: Team details not found for ID: " + effectiveTeamId); return; }
    setIsBidding(true);
    try {
      const currentHighest = bids.length > 0 ? bids[0].amount : (activePlayer.base_price - 1);
      const bidAmount = currentHighest + increment;
      const response = await fetch('/api/bids', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerId: activePlayer.id, teamId: effectiveTeamId, amount: bidAmount, increment_used: increment, userId: user.id })
      });
      if (!response.ok) { const errorData = await response.json(); throw new Error(errorData.error || `Server returned ${response.status}`); }
      const result = await response.json();
      if (!result.success) {
        alert(result.message || "Bidding conflict detected.");
        if (activePlayer?.id) fetchBids(activePlayer.id);
        setIsBidding(false); return;
      }
    } catch (err: any) {
      console.error('Bid failed:', err.message);
      alert(err.message || "Failed to submit bid.");
    } finally { setIsBidding(false); }
  }

  if (loading) return (
    <div className="min-h-screen bg-base flex items-center justify-center">
      <div className="w-6 h-6 border-2 border-border-strong border-t-accent rounded-full animate-spin" />
    </div>
  );

  // ─── No active player: waiting state ───
  if (!activePlayer) {
    return (
      <div className="min-h-screen bg-base text-ink font-sans pb-28">
        {/* Top bar */}
        <div className="border-b border-border bg-surface/50">
          <div className="max-w-screen-2xl mx-auto flex items-center justify-between px-5 sm:px-8 py-4">
            <div className="flex items-center gap-3">
              <div className="w-7 h-7 rounded-full border-2 border-accent flex items-center justify-center">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="var(--color-accent)"><path d="M12 2L14.09 8.26L20.5 9.27L15.75 13.97L17.18 20.5L12 17.27L6.82 20.5L8.25 13.97L3.5 9.27L9.91 8.26L12 2Z" /></svg>
              </div>
              <span className="font-hype text-base uppercase tracking-wider text-ink-muted">VFL Arena</span>
            </div>
            <div className="flex items-center gap-2 bg-surface-2 border border-border px-3 py-1.5 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-ink-faint" />
              <span className="text-[10px] font-semibold uppercase tracking-widest text-ink-muted">Between rounds</span>
            </div>
          </div>
        </div>

        <div className="max-w-6xl mx-auto px-5 sm:px-8 py-10 space-y-10">
          <div>
            <h2 className="font-hype text-4xl md:text-5xl uppercase tracking-tight text-ink mb-2">Waiting for<br/><span className="text-accent">next player</span></h2>
            <p className="text-ink-muted text-sm">The admin will spotlight the next name shortly.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* My Team / Standings */}
            <div className="md:col-span-1 bg-surface rounded-lg border border-border overflow-hidden">
              <div className="px-5 py-3 border-b border-border bg-surface-2">
                <h3 className="text-[10px] font-bold uppercase tracking-widest text-ink-faint">{userTeam ? 'Your franchise' : 'Standings'}</h3>
              </div>
              <div className="p-5">
                {userTeam ? (
                  <div className="space-y-5">
                    <div className="flex items-center gap-3">
                      <img src={userTeam.logo_url} className="w-10 h-10 rounded-lg border border-border bg-surface-2 object-cover" />
                      <div>
                        <p className="font-display font-semibold text-ink leading-none mb-1">{userTeam.name}</p>
                        <p className="text-[10px] text-ink-faint">{teamSquad.length} signed</p>
                      </div>
                    </div>
                    <div className="bg-accent/10 border border-accent/20 p-4 rounded-lg">
                      <div className="flex justify-between items-center mb-1">
                        <p className="text-[9px] text-accent uppercase tracking-widest font-bold">Budget</p>
                        <Wallet className="w-3.5 h-3.5 text-accent" />
                      </div>
                      <p className="tnum text-2xl font-bold text-accent">
                        {userTeam.total_budget - userTeam.points_spent} <span className="text-xs text-accent/50">VFL</span>
                      </p>
                    </div>
                    <div className="space-y-1.5">
                      <p className="text-[9px] font-bold text-ink-faint uppercase tracking-widest">Recent picks</p>
                      {teamSquad.slice(0, 3).map(p => (
                        <div key={p.id} className="flex justify-between items-center py-2 border-b border-border last:border-0">
                          <span className="text-sm text-ink">{p.name}</span>
                          <span className="tnum text-sm font-semibold text-accent">{p.sold_price}</span>
                        </div>
                      ))}
                      {teamSquad.length === 0 && <p className="text-xs text-ink-faint py-3">No players yet.</p>}
                    </div>
                    <div className="pt-4 border-t border-border">
                      <p className="text-[9px] font-bold text-ink-faint uppercase tracking-widest mb-2">Other franchises</p>
                      <div className="space-y-1.5 max-h-[140px] overflow-y-auto">
                        {allTeams.filter(t => t.id !== userTeam.id).map(t => (
                          <div key={t.id} className="flex justify-between items-center text-sm">
                            <span className="text-ink-muted truncate max-w-[120px]">{t.name}</span>
                            <span className="tnum text-ink-muted">{(t.total_budget || 100) - (t.points_spent || 0)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {allTeams.length > 0 ? allTeams.map((t, idx) => (
                      <div key={t.id} className="flex justify-between items-center py-2.5 border-b border-border last:border-0">
                        <div className="flex items-center gap-3">
                          <span className="tnum text-[10px] text-ink-faint w-4">{idx + 1}</span>
                          <img src={t.logo_url} className="w-6 h-6 rounded object-cover" />
                          <span className="text-sm text-ink">{t.name}</span>
                        </div>
                        <span className="tnum text-sm font-semibold text-accent">{t.total_budget - t.points_spent}</span>
                      </div>
                    )) : (
                      <div className="text-center py-10">
                        <div className="w-5 h-5 border-2 border-border-strong border-t-accent rounded-full animate-spin mx-auto" />
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Recent decisions */}
            <div className="bg-surface rounded-lg border border-border overflow-hidden">
              <div className="px-5 py-3 border-b border-border bg-surface-2">
                <h3 className="text-[10px] font-bold uppercase tracking-widest text-ink-faint">Recent decisions</h3>
              </div>
              <div className="p-5 space-y-2">
                {finishedPlayers.slice(0, 5).map(p => (
                  <div key={p.id} className="flex justify-between items-center py-2.5 border-b border-border last:border-0">
                    <div>
                      <p className="text-sm font-medium text-ink leading-none mb-1">{p.name}</p>
                      <p className={cn("text-[10px] font-bold uppercase tracking-widest", p.status === 'SOLD' ? 'text-success' : 'text-danger')}>
                        {p.status === 'SOLD' ? (p.teams?.name || 'Franchise') : 'Unsold'}
                      </p>
                    </div>
                    <span className="tnum text-sm font-semibold text-ink-muted">{p.sold_price || '—'}</span>
                  </div>
                ))}
                {finishedPlayers.length === 0 && <p className="text-xs text-ink-faint text-center py-8">No results yet.</p>}
              </div>
            </div>

            {/* Top sales */}
            <div className="bg-surface rounded-lg border border-border overflow-hidden">
              <div className="px-5 py-3 border-b border-border bg-surface-2 flex items-center justify-between">
                <h3 className="text-[10px] font-bold uppercase tracking-widest text-ink-faint">Top sales</h3>
                <Trophy className="w-3.5 h-3.5 text-gold" />
              </div>
              <div className="p-5 space-y-2">
                {finishedPlayers.filter(p => p.status === 'SOLD').sort((a, b) => (b.sold_price || 0) - (a.sold_price || 0)).slice(0, 4).map((p, idx) => (
                  <div key={p.id} className="flex justify-between items-center py-2.5 border-b border-border last:border-0">
                    <div className="flex items-center gap-2.5">
                      <span className={cn("tnum text-xs font-bold w-5 h-5 rounded flex items-center justify-center", idx === 0 ? "bg-gold/20 text-gold" : "bg-surface-2 text-ink-faint")}>{idx + 1}</span>
                      <div>
                        <p className="text-sm font-medium text-ink leading-none mb-1">{p.name}</p>
                        <p className="text-[10px] text-ink-faint">{p.teams?.name}</p>
                      </div>
                    </div>
                    <span className={cn("tnum text-sm font-bold", idx === 0 ? "text-gold" : "text-accent")}>{p.sold_price}</span>
                  </div>
                ))}
                {finishedPlayers.filter(p => p.status === 'SOLD').length === 0 && <p className="text-xs text-ink-faint text-center py-8">No sales yet.</p>}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─── Active player: live auction ───
  const isLeadingBid = userTeamId && bids.length > 0 && bids[0]?.team_id === userTeamId;

  return (
    <div className="min-h-screen bg-base text-ink font-sans pb-28">
      {/* === Broadcast bar === */}
      <div className="bg-surface border-b border-border sticky top-0 z-50">
        <div className="max-w-screen-2xl mx-auto flex items-center justify-between px-5 sm:px-8 h-14">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 bg-danger/10 border border-danger/30 px-3 py-1 rounded-full">
              <span className="w-2 h-2 rounded-full bg-danger live-dot" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-danger">Live</span>
            </div>
            <h1 className="font-hype text-xl sm:text-2xl uppercase tracking-wide text-ink">{activePlayer.name}</h1>
          </div>
          {userTeam && (
            <div className="hidden sm:flex items-center gap-3 bg-surface-2 border border-border px-4 py-2 rounded-lg">
              <img src={userTeam.logo_url} className="w-6 h-6 rounded-full border border-border" />
              <span className="text-xs font-medium text-ink-muted">{userTeam.name}</span>
              <div className="w-px h-4 bg-border" />
              <span className="tnum text-sm font-bold text-accent">{(userTeam.total_budget || 100) - (userTeam.points_spent || 0)}</span>
              <span className="text-[9px] text-ink-faint uppercase">VFL</span>
            </div>
          )}
        </div>
      </div>

      <main className="max-w-screen-2xl mx-auto px-5 sm:px-8 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* Left: details + bids */}
          <div className="lg:col-span-3 space-y-4 order-2 lg:order-1">
            <div className="bg-surface rounded-lg border border-border overflow-hidden">
              <div className="px-4 py-2.5 border-b border-border bg-surface-2">
                <h3 className="text-[9px] font-bold uppercase tracking-widest text-ink-faint">Player info</h3>
              </div>
              <div className="p-4 grid grid-cols-2 gap-3">
                {[
                  { l: 'Year', v: activePlayer.year || 'N/A' },
                  { l: 'Tier', v: activePlayer.tier },
                  { l: 'Position', v: activePlayer.department || activePlayer.position },
                  { l: 'Base', v: `${activePlayer.base_price} VFL`, accent: true },
                ].map(s => (
                  <div key={s.l}>
                    <span className="block text-[9px] text-ink-faint uppercase tracking-widest">{s.l}</span>
                    <span className={cn("text-sm font-medium", s.accent ? "text-accent" : "text-ink")}>{s.v}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-surface rounded-lg border border-border overflow-hidden max-h-[380px]">
              <div className="px-4 py-2.5 border-b border-border bg-surface-2 flex justify-between">
                <h3 className="text-[9px] font-bold uppercase tracking-widest text-ink-faint">Bid log</h3>
                <span className="tnum text-[9px] font-bold text-ink-faint">{bids.length}</span>
              </div>
              <div className="p-4 space-y-2 overflow-y-auto">
                {bids.length > 0 ? bids.map((bid, i) => (
                  <motion.div
                    key={bid.id}
                    layout
                    initial={i === 0 ? { scale: 1.03, opacity: 0.8 } : false}
                    animate={{ scale: 1, opacity: 1 }}
                    className={cn(
                      "flex justify-between items-center py-2.5 border-b border-border last:border-0",
                      i === 0 && "bg-accent/5 -mx-2 px-2 rounded"
                    )}
                  >
                    <div>
                      <span className={cn("block text-[9px] font-bold uppercase tracking-widest", i === 0 ? "text-accent" : "text-ink-faint")}>
                        {i === 0 ? 'Leading' : 'Outbid'}
                      </span>
                      <span className="text-sm text-ink">{bid.teams?.name || 'Team'}</span>
                    </div>
                    <span className={cn("tnum text-base font-bold", i === 0 ? "text-accent" : "text-ink-muted")}>{bid.amount}</span>
                  </motion.div>
                )) : (
                  <div className="text-center py-8 text-ink-faint text-xs">No bids yet</div>
                )}
              </div>
            </div>
          </div>

          {/* Center: player spotlight */}
          <div className="lg:col-span-6 flex flex-col items-center justify-center order-1 lg:order-2">
            <div className={cn(
              "tier-stripe w-full max-w-[440px] aspect-[3.5/5] rounded-xl overflow-hidden relative border border-border transition-all duration-500",
              activePlayer.tier === 'GOLD' ? 'tier-stripe--gold' : activePlayer.tier === 'SILVER' ? 'tier-stripe--silver' : 'tier-stripe--bronze',
              (activePlayer.status === 'SOLD' || activePlayer.status === 'UNSOLD') && "opacity-50"
            )}>
              <img
                alt={activePlayer.name}
                className="w-full h-full object-cover grayscale-[0.15]"
                src={activePlayer.photo_url || 'https://images.unsplash.com/photo-1543326727-cf6c39e8f84c?q=80&w=1470&auto=format&fit=crop'}
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black via-black/10 to-transparent" />

              {/* SOLD / UNSOLD overlay */}
              <AnimatePresence>
                {(activePlayer.status === 'SOLD' || activePlayer.status === 'UNSOLD') && (
                  <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/50 backdrop-blur-[2px] overflow-hidden">
                    <motion.div
                      initial={{ scale: 0.3, opacity: 0.7 }}
                      animate={{ scale: 2.5, opacity: 0 }}
                      transition={{ duration: 1.2, ease: 'easeOut' }}
                      className={cn("absolute w-40 h-40 rounded-full", activePlayer.status === 'SOLD' ? "bg-success" : "bg-danger")}
                    />
                    <motion.div
                      initial={{ scale: 0.3, opacity: 0, rotate: -8 }}
                      animate={{ scale: 1, opacity: 1, rotate: -6 }}
                      transition={{ type: 'spring', stiffness: 300, damping: 16 }}
                      className={cn(
                        "relative px-10 py-4 rounded-lg font-hype text-4xl uppercase tracking-widest",
                        activePlayer.status === 'SOLD' ? "bg-success text-success-ink" : "bg-danger text-danger-ink"
                      )}
                    >
                      {activePlayer.status === 'SOLD' ? 'Sold' : 'Unsold'}
                    </motion.div>
                  </div>
                )}
              </AnimatePresence>

              {/* Bottom info */}
              <div className="absolute bottom-0 inset-x-0 p-6 flex flex-col items-center text-center">
                <h2 className="font-hype text-5xl lg:text-6xl text-white mb-4 uppercase tracking-wide drop-shadow-[0_2px_12px_rgba(0,0,0,0.8)]">
                  {activePlayer.name}
                </h2>
                <div className="flex items-center gap-6">
                  <div className="flex flex-col items-center">
                    <span className="text-[9px] uppercase tracking-widest text-white/50 mb-1">Base</span>
                    <span className="tnum text-lg font-bold text-white">{activePlayer.base_price}</span>
                  </div>
                  <div className="w-px h-8 bg-white/20" />
                  <div className="flex flex-col items-center overflow-hidden">
                    <span className="text-[9px] uppercase tracking-widest text-accent mb-1">Current bid</span>
                    <AnimatePresence mode="popLayout">
                      <motion.span
                        key={bids[0]?.amount ?? 'none'}
                        initial={{ y: 20, opacity: 0, scale: 1.4 }}
                        animate={{ y: 0, opacity: 1, scale: 1 }}
                        exit={{ y: -20, opacity: 0 }}
                        transition={{ type: 'spring', stiffness: 400, damping: 22 }}
                        className="tnum text-3xl font-bold text-accent block"
                      >
                        {bids[0]?.amount || '—'}
                      </motion.span>
                    </AnimatePresence>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right: bid controls */}
          <div className="lg:col-span-3 space-y-4 order-3">
            <div className="bg-surface rounded-lg border border-border overflow-hidden">
              <div className="px-4 py-2.5 border-b border-border bg-surface-2">
                <h3 className="text-[9px] font-bold uppercase tracking-widest text-ink-faint">
                  {userTeamId ? (bids.length === 0 ? 'Open bid' : isLeadingBid ? 'You lead' : 'Raise') : 'Spectator'}
                </h3>
              </div>
              <div className="p-4">
                {/* Timer */}
                {timeLeft !== null && (
                  <div className="mb-4 bg-surface-2 rounded-lg p-3 flex items-center gap-3">
                    <motion.div
                      animate={timeLeft <= 10 ? { scale: [1, 1.15, 1] } : { scale: 1 }}
                      transition={timeLeft <= 10 ? { duration: 0.8, repeat: Infinity, ease: 'easeInOut' } : {}}
                      className={cn(
                        "tnum w-11 h-11 rounded-full border-2 flex items-center justify-center text-lg font-bold",
                        timeLeft <= 10 ? "border-danger text-danger" : "border-accent text-accent"
                      )}
                    >
                      {timeLeft}
                    </motion.div>
                    <div>
                      <p className="text-[9px] font-bold uppercase tracking-widest text-ink-muted">Time left</p>
                      <p className="text-[10px] text-ink-faint">Synced for everyone</p>
                    </div>
                  </div>
                )}

                <div className="flex flex-col gap-2">
                  {!userTeamId ? (
                    <div className="bg-surface-2 p-6 rounded-lg flex flex-col items-center gap-3 text-center">
                      <Users className="w-6 h-6 text-ink-faint" />
                      <div>
                        <span className="text-xs font-medium text-ink-muted">Viewer access</span>
                        <p className="text-[11px] text-ink-faint mt-1">Only franchises can bid.</p>
                      </div>
                    </div>
                  ) : bids.length === 0 ? (
                    <button
                      disabled={isBidding || session?.status !== 'LIVE'}
                      onClick={() => handleBid(1)}
                      className="w-full bg-accent hover:bg-accent-hover text-accent-ink p-5 rounded-lg active:scale-[0.98] transition-all disabled:opacity-50"
                    >
                      <div className="flex flex-col items-center gap-1">
                        <span className="text-[10px] font-bold uppercase tracking-widest opacity-80">Open bid</span>
                        <span className="font-hype text-3xl">{activePlayer.base_price} VFL</span>
                      </div>
                    </button>
                  ) : (
                    [1, 2, 3, 4, 5].map(inc => {
                      const nextAmount = (bids[0]?.amount || activePlayer.base_price) + inc;
                      return (
                        <button
                          key={inc}
                          disabled={isBidding || session?.status !== 'LIVE' || !!isLeadingBid}
                          onClick={() => handleBid(inc)}
                          className={cn(
                            "flex items-center justify-between p-3 rounded-lg border transition-all disabled:opacity-35 disabled:cursor-not-allowed",
                            isLeadingBid
                              ? "bg-success/5 border-success/20"
                              : "bg-surface-2 hover:bg-surface-3 border-border hover:border-accent/30 active:scale-[0.98]"
                          )}
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-lg bg-accent/10 flex items-center justify-center tnum text-sm font-bold text-accent">
                              +{inc}
                            </div>
                            <div className="text-left">
                              <span className="block text-xs font-semibold text-ink">Raise</span>
                              <span className="block tnum text-[10px] text-ink-faint">{nextAmount} VFL</span>
                            </div>
                          </div>
                          <Plus className="w-3.5 h-3.5 text-ink-faint" />
                        </button>
                      );
                    })
                  )}
                </div>

                {isBidding && (
                  <div className="mt-3 pt-3 border-t border-border flex items-center justify-center gap-2 text-xs text-ink-faint">
                    <div className="w-3.5 h-3.5 border-2 border-border-strong border-t-accent rounded-full animate-spin" />
                    Submitting
                  </div>
                )}

                {isLeadingBid && !isBidding && (
                  <div className="mt-3 pt-3 border-t border-border text-center">
                    <span className="text-[10px] font-bold text-success uppercase tracking-widest">You hold the highest bid</span>
                  </div>
                )}
              </div>
            </div>

            {/* Franchise budgets */}
            <div className="bg-surface rounded-lg border border-border overflow-hidden">
              <div className="px-4 py-2.5 border-b border-border bg-surface-2">
                <h3 className="text-[9px] font-bold uppercase tracking-widest text-ink-faint">Budgets</h3>
              </div>
              <div className="p-3 grid grid-cols-2 gap-2">
                {allTeams.map(t => (
                  <div key={t.id} className={cn(
                    "p-2.5 rounded-lg border",
                    userTeamId === t.id ? "bg-accent/5 border-accent/20" : "bg-surface-2 border-transparent"
                  )}>
                    <div className="text-[10px] text-ink-faint truncate mb-0.5">{t.name}</div>
                    <p className="tnum text-xs font-bold text-ink">{(t.total_budget || 100) - (t.points_spent || 0)}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Outbid toast */}
      <AnimatePresence>
        {outbidToast && (
          <motion.div
            initial={{ x: 100, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 100, opacity: 0 }}
            className="fixed bottom-24 right-5 z-50 max-w-sm w-full"
          >
            <div className="bg-surface border border-danger/30 p-4 rounded-lg shadow-xl flex gap-3 items-start">
              <div className="bg-danger/10 p-2 rounded-lg"><AlertTriangle className="w-4 h-4 text-danger" /></div>
              <div className="flex-1">
                <span className="text-sm font-semibold text-ink">Outbid!</span>
                <span className="block text-xs text-ink-muted mt-0.5">Another franchise raised on {activePlayer.name}.</span>
              </div>
              <button onClick={() => setOutbidToast(false)} className="text-ink-faint hover:text-ink"><X className="w-4 h-4" /></button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Sell animation overlay */}
      <AnimatePresence>
        {sellAnimation && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-6 pointer-events-none bg-black/70 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-surface border border-border p-10 rounded-xl w-full max-w-sm text-center"
            >
              <span className={cn(
                "inline-block px-5 py-2 rounded-full text-xs font-bold uppercase tracking-widest mb-5",
                sellAnimation.type === 'SOLD' ? "bg-success text-success-ink" : "bg-danger text-danger-ink"
              )}>
                {sellAnimation.type}
              </span>
              <h2 className="font-hype text-4xl text-ink mb-3 uppercase">{sellAnimation.player.name}</h2>
              {sellAnimation.type === 'SOLD' && (
                <p className="tnum text-xl font-bold text-accent">{sellAnimation.player.sold_price} VFL</p>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

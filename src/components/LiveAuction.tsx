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

  // ─── No active player: waiting/between-rounds state ───
  if (!activePlayer) {
    return (
      <div className="min-h-screen bg-base text-ink font-sans pb-28">
        {/* Sky Sports style "BETWEEN ROUNDS" banner */}
        <div className="bg-surface-2 border-b-2 border-accent">
          <div className="max-w-screen-2xl mx-auto flex items-center justify-between px-5 sm:px-8 py-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-accent/10 border border-accent/20 flex items-center justify-center">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="var(--color-accent)"><path d="M12 2L14.09 8.26L20.5 9.27L15.75 13.97L17.18 20.5L12 17.27L6.82 20.5L8.25 13.97L3.5 9.27L9.91 8.26L12 2Z" /></svg>
              </div>
              <span className="font-hype text-lg uppercase tracking-wider text-ink">VFL Arena</span>
            </div>
            <div className="flex items-center gap-2 bg-ink-faint/10 px-4 py-2 rounded-full">
              <span className="w-2 h-2 rounded-full bg-ink-faint" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-ink-muted">Between rounds</span>
            </div>
          </div>
        </div>

        {/* Waiting hero */}
        <div className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-accent/[0.06] to-transparent pointer-events-none" />
          <div className="max-w-6xl mx-auto px-5 sm:px-8 pt-12 pb-8">
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            >
              <h2 className="font-hype text-5xl md:text-6xl uppercase tracking-tight text-ink mb-2">
                Waiting for<br /><span className="text-accent">next player</span>
              </h2>
              <p className="text-ink-muted text-sm">The admin will spotlight the next name shortly.</p>
            </motion.div>
          </div>
        </div>

        <div className="max-w-6xl mx-auto px-5 sm:px-8 space-y-5">
          {/* Budget ticker — horizontal league table style */}
          {allTeams.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1, duration: 0.4 }}
              className="bg-surface-2 border border-border rounded-xl overflow-hidden"
            >
              <div className="px-4 py-2.5 border-b border-border flex items-center justify-between">
                <span className="text-[9px] font-bold uppercase tracking-widest text-ink-faint">Franchise Budgets</span>
                <Wallet className="w-3.5 h-3.5 text-accent" />
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                {allTeams.map((t, i) => {
                  const remaining = (t.total_budget || 100) - (t.points_spent || 0);
                  const isMyTeam = userTeamId === t.id;
                  return (
                    <div key={t.id} className={cn(
                      "px-4 py-3 border-b border-r border-border last:border-r-0 flex items-center gap-2.5",
                      isMyTeam && "bg-accent/5"
                    )}>
                      {t.logo_url ? (
                        <img src={t.logo_url} className="w-6 h-6 rounded object-cover flex-shrink-0" />
                      ) : (
                        <div className="w-6 h-6 rounded flex-shrink-0" style={{ background: t.color || 'var(--color-accent)' }} />
                      )}
                      <div className="min-w-0">
                        <span className="block text-[10px] text-ink-muted truncate">{t.name}</span>
                        <span className={cn("tnum text-sm font-bold", isMyTeam ? "text-accent" : "text-ink")}>{remaining}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* My Team panel */}
            {userTeam && (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15, duration: 0.4 }}
                className="rounded-xl overflow-hidden border border-border"
              >
                <div className="px-5 py-4" style={{ background: `linear-gradient(135deg, ${userTeam.color || 'var(--color-accent)'}, ${userTeam.color || 'var(--color-accent)'}88)` }}>
                  <div className="flex items-center gap-3">
                    {userTeam.logo_url && <img src={userTeam.logo_url} className="w-10 h-10 rounded-lg border-2 border-white/20 bg-black/20 object-cover" />}
                    <div>
                      <h3 className="font-hype text-xl uppercase text-white">{userTeam.name}</h3>
                      <p className="text-[10px] text-white/50">{teamSquad.length} signed</p>
                    </div>
                    <div className="ml-auto text-right">
                      <span className="tnum text-2xl font-bold text-white">{userTeam.total_budget - userTeam.points_spent}</span>
                      <span className="block text-[9px] text-white/40 uppercase tracking-widest">VFL</span>
                    </div>
                  </div>
                </div>
                <div className="bg-surface p-4 space-y-1.5">
                  <p className="text-[9px] font-bold text-ink-faint uppercase tracking-widest mb-2">Recent picks</p>
                  {teamSquad.slice(0, 4).map(p => (
                    <div key={p.id} className="flex justify-between items-center py-2 border-b border-border last:border-0">
                      <span className="text-sm text-ink">{p.name}</span>
                      <span className="tnum text-sm font-semibold text-accent">{p.sold_price}</span>
                    </div>
                  ))}
                  {teamSquad.length === 0 && <p className="text-xs text-ink-faint py-3">No players yet.</p>}
                </div>
              </motion.div>
            )}

            {/* Recent decisions + Top sales */}
            <div className="space-y-5">
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2, duration: 0.4 }}
                className="bg-surface rounded-xl border border-border overflow-hidden"
              >
                <div className="px-4 py-2.5 border-b border-border bg-surface-2">
                  <h3 className="text-[9px] font-bold uppercase tracking-widest text-ink-faint">Recent decisions</h3>
                </div>
                <div className="p-4 space-y-1">
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
              </motion.div>

              {/* Top sales — gold accent */}
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25, duration: 0.4 }}
                className="bg-surface rounded-xl border border-border overflow-hidden"
              >
                <div className="px-4 py-2.5 border-b border-border bg-surface-2 flex items-center justify-between">
                  <h3 className="text-[9px] font-bold uppercase tracking-widest text-ink-faint">Top sales</h3>
                  <Trophy className="w-3.5 h-3.5 text-gold" />
                </div>
                <div className="p-4 space-y-1">
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
              </motion.div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─── Active player: LIVE BROADCAST ───
  const isLeadingBid = userTeamId && bids.length > 0 && bids[0]?.team_id === userTeamId;
  const tierColor = activePlayer.tier === 'GOLD' ? '#ffd600' : activePlayer.tier === 'SILVER' ? '#90a4ae' : '#bf6b2a';

  return (
    <div className="min-h-screen bg-base text-ink font-sans pb-28">
      {/* === SKY SPORTS BROADCAST BAR === */}
      <div className="sticky top-0 z-50 bg-surface-2 border-b-2 border-danger">
        <div className="max-w-screen-2xl mx-auto flex items-center justify-between px-5 sm:px-8 h-14">
          <div className="flex items-center gap-4">
            {/* Pulsing LIVE badge — prominent */}
            <div className="flex items-center gap-2 bg-danger px-4 py-1.5 rounded-md">
              <span className="w-2 h-2 rounded-full bg-white live-dot" />
              <span className="text-[11px] font-bold uppercase tracking-widest text-white">Live</span>
            </div>
            <div className="hidden sm:block w-px h-6 bg-border" />
            <h1 className="font-hype text-xl sm:text-2xl uppercase tracking-wide text-ink">{activePlayer.name}</h1>
            {/* Tier badge */}
            <span className="hidden sm:inline-block px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider" style={{ background: `${tierColor}20`, color: tierColor }}>
              {activePlayer.tier}
            </span>
          </div>

          {/* Timer in broadcast bar when active */}
          <div className="flex items-center gap-4">
            {timeLeft !== null && (
              <motion.div
                animate={timeLeft <= 10 ? { scale: [1, 1.08, 1] } : { scale: 1 }}
                transition={timeLeft <= 10 ? { duration: 0.8, repeat: Infinity, ease: 'easeInOut' } : {}}
                className={cn(
                  "flex items-center gap-2 px-3 py-1.5 rounded-lg border",
                  timeLeft <= 10 ? "bg-danger/10 border-danger/30" : "bg-surface border-border"
                )}
              >
                <span className={cn("tnum text-lg font-bold", timeLeft <= 10 ? "text-danger" : "text-accent")}>{timeLeft}s</span>
              </motion.div>
            )}
            {userTeam && (
              <div className="hidden sm:flex items-center gap-2.5 bg-surface border border-border px-3 py-1.5 rounded-lg">
                {userTeam.logo_url && <img src={userTeam.logo_url} className="w-5 h-5 rounded-full border border-border" />}
                <span className="tnum text-sm font-bold text-accent">{(userTeam.total_budget || 100) - (userTeam.points_spent || 0)}</span>
                <span className="text-[9px] text-ink-faint">VFL</span>
              </div>
            )}
          </div>
        </div>
      </div>

      <main className="max-w-screen-2xl mx-auto px-5 sm:px-8 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* LEFT — Player info + Bid log */}
          <div className="lg:col-span-3 space-y-4 order-2 lg:order-1">
            {/* Player stats — PL stats card style */}
            <div className="rounded-xl overflow-hidden border border-border">
              <div className="px-4 py-3 bg-surface-2 border-b border-border">
                <h3 className="text-[9px] font-bold uppercase tracking-widest text-ink-faint">Player profile</h3>
              </div>
              <div className="bg-surface">
                {[
                  { l: 'Position', v: activePlayer.department || activePlayer.position },
                  { l: 'Year', v: activePlayer.year || 'N/A' },
                  { l: 'Tier', v: activePlayer.tier, color: tierColor },
                  { l: 'Base Price', v: `${activePlayer.base_price} VFL`, accent: true },
                ].map((s, i) => (
                  <div key={s.l} className={cn("flex justify-between items-center px-4 py-3", i < 3 && "border-b border-border")}>
                    <span className="text-[10px] text-ink-faint uppercase tracking-widest">{s.l}</span>
                    <span className={cn("text-sm font-semibold", s.accent ? "text-accent" : s.color ? "" : "text-ink")} style={s.color ? { color: s.color } : undefined}>{s.v}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Bid log — scrollable */}
            <div className="rounded-xl overflow-hidden border border-border max-h-[380px] flex flex-col">
              <div className="px-4 py-3 bg-surface-2 border-b border-border flex justify-between flex-shrink-0">
                <h3 className="text-[9px] font-bold uppercase tracking-widest text-ink-faint">Bid history</h3>
                <span className="tnum text-[9px] font-bold text-ink-faint">{bids.length}</span>
              </div>
              <div className="p-3 space-y-1 overflow-y-auto bg-surface flex-1">
                {bids.length > 0 ? bids.map((bid, i) => (
                  <motion.div
                    key={bid.id}
                    layout
                    initial={i === 0 ? { scale: 1.03, opacity: 0.8 } : false}
                    animate={{ scale: 1, opacity: 1 }}
                    className={cn(
                      "flex justify-between items-center px-3 py-2.5 rounded-lg",
                      i === 0 ? "bg-accent/10 border border-accent/20" : "border border-transparent"
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

          {/* CENTER — Player spotlight (UCL matchday graphic style) */}
          <div className="lg:col-span-6 flex flex-col items-center justify-center order-1 lg:order-2">
            <div className={cn(
              "w-full max-w-[480px] aspect-[3.5/5] rounded-2xl overflow-hidden relative border-2 transition-all duration-500",
              (activePlayer.status === 'SOLD' || activePlayer.status === 'UNSOLD') && "opacity-50"
            )} style={{ borderColor: tierColor }}>
              {/* Tier stripe at top */}
              <div className="absolute top-0 left-0 right-0 h-1 z-20" style={{ background: tierColor }} />

              <img
                alt={activePlayer.name}
                className="w-full h-full object-cover grayscale-[0.15]"
                src={activePlayer.photo_url || 'https://images.unsplash.com/photo-1543326727-cf6c39e8f84c?q=80&w=1470&auto=format&fit=crop'}
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />

              {/* SOLD / UNSOLD overlay — "DONE DEAL" style */}
              <AnimatePresence>
                {(activePlayer.status === 'SOLD' || activePlayer.status === 'UNSOLD') && (
                  <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/60 backdrop-blur-[3px] overflow-hidden">
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
                        "relative px-10 py-5 rounded-xl font-hype text-5xl uppercase tracking-widest border-4",
                        activePlayer.status === 'SOLD'
                          ? "bg-success text-success-ink border-success"
                          : "bg-danger text-danger-ink border-danger"
                      )}
                    >
                      {activePlayer.status === 'SOLD' ? 'SOLD' : 'UNSOLD'}
                    </motion.div>
                  </div>
                )}
              </AnimatePresence>

              {/* Bottom: name + scoreboard bid */}
              <div className="absolute bottom-0 inset-x-0 p-6">
                <h2 className="font-hype text-5xl lg:text-6xl text-white mb-5 uppercase tracking-wide drop-shadow-[0_2px_12px_rgba(0,0,0,0.8)]">
                  {activePlayer.name}
                </h2>
                {/* Scoreboard-style current bid */}
                <div className="flex items-end gap-6 bg-black/50 backdrop-blur-sm rounded-xl px-5 py-4 border border-white/10">
                  <div>
                    <span className="text-[9px] uppercase tracking-widest text-white/50 block mb-1">Base</span>
                    <span className="tnum text-lg font-bold text-white">{activePlayer.base_price}</span>
                  </div>
                  <div className="w-px h-10 bg-white/20" />
                  <div className="flex-1">
                    <span className="text-[9px] uppercase tracking-widest text-accent block mb-1">Current bid</span>
                    <AnimatePresence mode="popLayout">
                      <motion.span
                        key={bids[0]?.amount ?? 'none'}
                        initial={{ y: 24, opacity: 0, scale: 1.4 }}
                        animate={{ y: 0, opacity: 1, scale: 1 }}
                        exit={{ y: -24, opacity: 0 }}
                        transition={{ type: 'spring', stiffness: 400, damping: 22 }}
                        className="tnum text-4xl font-bold text-accent block"
                      >
                        {bids[0]?.amount || '—'}
                      </motion.span>
                    </AnimatePresence>
                  </div>
                  {bids[0]?.teams?.name && (
                    <div className="text-right">
                      <span className="text-[9px] uppercase tracking-widest text-white/50 block mb-1">Leader</span>
                      <span className="text-sm font-bold text-white">{bids[0].teams.name}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT — Bid controls */}
          <div className="lg:col-span-3 space-y-4 order-3">
            {/* Bid panel */}
            <div className="rounded-xl overflow-hidden border-2 border-accent/30 bg-surface">
              <div className="px-4 py-3 bg-accent/10 border-b border-accent/20">
                <h3 className="text-[10px] font-bold uppercase tracking-widest text-accent">
                  {userTeamId ? (bids.length === 0 ? 'Open bid' : isLeadingBid ? 'You lead' : 'Place your bid') : 'Spectator mode'}
                </h3>
              </div>
              <div className="p-4">
                <div className="flex flex-col gap-2">
                  {!userTeamId ? (
                    <div className="bg-surface-2 p-6 rounded-xl flex flex-col items-center gap-3 text-center">
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
                      className="w-full bg-accent hover:bg-accent-hover text-accent-ink p-5 rounded-xl active:scale-[0.98] transition-all disabled:opacity-50"
                    >
                      <div className="flex flex-col items-center gap-1">
                        <span className="text-[10px] font-bold uppercase tracking-widest opacity-80">Open bid</span>
                        <span className="font-hype text-4xl">{activePlayer.base_price} VFL</span>
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
                            "flex items-center justify-between p-3.5 rounded-xl border-2 transition-all disabled:opacity-35 disabled:cursor-not-allowed",
                            isLeadingBid
                              ? "bg-success/5 border-success/20"
                              : "bg-surface-2 hover:bg-surface-3 border-border hover:border-accent/40 active:scale-[0.98]"
                          )}
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center tnum text-base font-bold text-accent">
                              +{inc}
                            </div>
                            <div className="text-left">
                              <span className="block text-sm font-semibold text-ink">Raise +{inc}</span>
                              <span className="block tnum text-[10px] text-ink-faint">{nextAmount} VFL total</span>
                            </div>
                          </div>
                          <Plus className="w-4 h-4 text-ink-faint" />
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
                  <div className="mt-3 pt-3 border-t border-success/20 text-center">
                    <span className="text-[10px] font-bold text-success uppercase tracking-widest">You hold the highest bid</span>
                  </div>
                )}
              </div>
            </div>

            {/* Franchise budgets — compact */}
            <div className="rounded-xl overflow-hidden border border-border bg-surface">
              <div className="px-4 py-2.5 border-b border-border bg-surface-2">
                <h3 className="text-[9px] font-bold uppercase tracking-widest text-ink-faint">Budgets</h3>
              </div>
              <div className="p-3 space-y-1">
                {allTeams.map(t => {
                  const remaining = (t.total_budget || 100) - (t.points_spent || 0);
                  const pct = t.total_budget > 0 ? Math.min(100, ((t.points_spent || 0) / t.total_budget) * 100) : 0;
                  return (
                    <div key={t.id} className={cn(
                      "px-3 py-2 rounded-lg",
                      userTeamId === t.id ? "bg-accent/5" : ""
                    )}>
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-[10px] text-ink-muted truncate max-w-[100px]">{t.name}</span>
                        <span className="tnum text-xs font-bold text-ink">{remaining}</span>
                      </div>
                      <div className="h-1 bg-surface-2 rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: t.color || 'var(--color-accent)' }} />
                      </div>
                    </div>
                  );
                })}
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
            <div className="bg-danger/10 border-2 border-danger/30 p-4 rounded-xl shadow-xl flex gap-3 items-start backdrop-blur-sm">
              <div className="bg-danger/20 p-2 rounded-lg"><AlertTriangle className="w-4 h-4 text-danger" /></div>
              <div className="flex-1">
                <span className="text-sm font-bold text-danger">OUTBID!</span>
                <span className="block text-xs text-ink-muted mt-0.5">Another franchise raised on {activePlayer.name}.</span>
              </div>
              <button onClick={() => setOutbidToast(false)} className="text-ink-faint hover:text-ink"><X className="w-4 h-4" /></button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Sell animation overlay — "DONE DEAL" moment */}
      <AnimatePresence>
        {sellAnimation && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-6 pointer-events-none bg-black/70 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-sm text-center"
            >
              {/* Radiating ring */}
              <motion.div
                initial={{ scale: 0.5, opacity: 0.8 }}
                animate={{ scale: 3, opacity: 0 }}
                transition={{ duration: 1.5, ease: 'easeOut' }}
                className={cn("absolute inset-0 mx-auto my-auto w-32 h-32 rounded-full border-4", sellAnimation.type === 'SOLD' ? "border-success" : "border-danger")}
              />
              <div className="relative bg-surface border-2 border-border p-10 rounded-2xl">
                <motion.span
                  initial={{ scale: 0.5, rotate: -12 }}
                  animate={{ scale: 1, rotate: -3 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 14 }}
                  className={cn(
                    "inline-block px-6 py-2.5 rounded-lg text-sm font-bold uppercase tracking-widest mb-5 border-2",
                    sellAnimation.type === 'SOLD' ? "bg-success text-success-ink border-success" : "bg-danger text-danger-ink border-danger"
                  )}
                >
                  {sellAnimation.type === 'SOLD' ? 'DONE DEAL' : 'UNSOLD'}
                </motion.span>
                <h2 className="font-hype text-4xl text-ink mb-3 uppercase">{sellAnimation.player.name}</h2>
                {sellAnimation.type === 'SOLD' && (
                  <p className="tnum text-2xl font-bold text-accent">{sellAnimation.player.sold_price} VFL</p>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

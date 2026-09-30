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
            .from('bids')
            .select('team_id')
            .eq('player_id', payload.new.player_id)
            .eq('is_undone', false)
            .order('created_at', { ascending: false })
            .range(1, 1)
            .maybeSingle();
          if (prevBid?.team_id === userTeamId) {
            setOutbidToast(true);
            setTimeout(() => setOutbidToast(false), 5000);
          }
        }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'players' }, async (payload: any) => {
        if (payload.new.status === 'SOLD' || payload.new.status === 'UNSOLD') {
           setTimeout(async () => {
              fetchFinished();
              fetchUpcoming();
              fetchAllTeams();
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
          setUserTeam(payload.new);
          fetchTeamSquad(userTeamId);
        }
        fetchAllTeams();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(sessionSub);
    };
  }, [user, userTeamId]);

  useEffect(() => {
    if (!session?.timer_expires_at || session?.status !== 'LIVE') {
      setTimeLeft(null);
      return;
    }

    const timer = setInterval(() => {
      const now = new Date().getTime();
      const expires = new Date(session.timer_expires_at).getTime();
      const diff = Math.max(0, Math.floor((expires - now) / 1000));

      setTimeLeft(diff);

      if (diff === 0) clearInterval(timer);
    }, 1000);

    return () => clearInterval(timer);
  }, [session?.timer_expires_at, session?.status]);

  async function fetchFinished() {
    const { data } = await supabase
      .from('players')
      .select('*, teams(*)')
      .or('status.eq.SOLD,status.eq.UNSOLD')
      .order('updated_at', { ascending: false });
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

    let teamId = null;
    let team = null;

    if (user) {
       const { data: profile } = await supabase.from('users').select('id, team_id').eq('id', user.id).maybeSingle();
       if (profile?.team_id) {
          teamId = profile.team_id;
          const { data: teamData } = await supabase.from('teams').select('*').eq('id', teamId).maybeSingle();
          team = teamData;
       }
    }

    setSession(sess);
    setUserTeamId(teamId);
    setUserTeam(team);

    if (sess?.current_player_id) {
      fetchPlayer(sess.current_player_id);
      fetchBids(sess.current_player_id);
    }

    fetchFinished();
    fetchUpcoming();
    fetchAllTeams();
    if (teamId) fetchTeamSquad(teamId);

    setLoading(false);
  }

  async function fetchPlayer(id: string) {
    const { data } = await supabase.from('players').select('*').eq('id', id).single();
    setActivePlayer(data);
  }

  async function fetchBids(playerId: string) {
    if (!playerId) return;
    const { data } = await supabase
      .from('bids')
      .select('*, teams(name)')
      .eq('player_id', playerId)
      .eq('is_undone', false)
      .order('created_at', { ascending: false });
    setBids(data || []);
  }

  async function handleBid(increment: number) {
    if (!activePlayer || isBidding || session?.status !== 'LIVE') return;

    let effectiveTeamId = userTeamId;
    let effectiveTeam = userTeam;

    if (user && (!effectiveTeamId || !effectiveTeam)) {
       const { data: profile } = await supabase.from('users')
          .select('id, team_id, role')
          .ilike('email', user.email || '')
          .maybeSingle();

       if (profile) {
         effectiveTeamId = profile.team_id;

         if (effectiveTeamId) {
            const { data: teamData } = await supabase.from('teams')
               .select('*')
               .eq('id', effectiveTeamId)
               .maybeSingle();

            effectiveTeam = teamData;
         }

         setUserTeamId(effectiveTeamId);
         setUserTeam(effectiveTeam);
       }
    }

    if (!user) {
      alert("Please login to place bids");
      return;
    }

    if (!effectiveTeamId) {
      alert("No team assigned! Admin must assign " + user.email + " to a team first.");
      return;
    }

    if (!effectiveTeam) {
       alert("Error: Team details not found for ID: " + effectiveTeamId);
       return;
    }

    setIsBidding(true);

    try {
      const currentHighest = bids.length > 0 ? bids[0].amount : (activePlayer.base_price - 1);
      const bidAmount = currentHighest + increment;

      const response = await fetch('/api/bids', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playerId: activePlayer.id,
          teamId: effectiveTeamId,
          amount: bidAmount,
          increment_used: increment,
          userId: user.id
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Server returned ${response.status}`);
      }

      const result = await response.json();

      if (!result.success) {
        alert(result.message || "Bidding conflict detected.");
        if (activePlayer?.id) fetchBids(activePlayer.id);
        setIsBidding(false);
        return;
      }
    } catch (err: any) {
      console.error('Bid failed:', err.message);
      alert(err.message || "Failed to submit bid.");
    } finally {
      setIsBidding(false);
    }
  }

  if (loading) return (
    <div className="min-h-screen bg-base flex items-center justify-center">
      <div className="w-6 h-6 border-2 border-border-strong border-t-accent rounded-full animate-spin" />
    </div>
  );

  if (!activePlayer) {
    return (
      <div className="min-h-screen bg-base text-ink font-sans">
        <header className="max-w-screen-2xl mx-auto flex justify-between items-center px-6 pt-8 pb-4">
          <span className="font-display font-semibold text-sm text-ink-muted">VFL Arena</span>
          <div className="flex items-center gap-2 bg-surface border border-border px-3 py-1.5 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-ink-faint" />
            <span className="text-[10px] font-medium uppercase tracking-wide text-ink-muted">Between rounds</span>
          </div>
        </header>

        <main className="max-w-6xl mx-auto px-6 py-10 space-y-12">
          <div>
            <h2 className="font-display text-3xl md:text-4xl font-bold text-ink mb-1">Waiting for the next player</h2>
            <p className="text-ink-muted text-sm">The admin will spotlight the next name shortly.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* My Team */}
            <div className="md:col-span-1">
              <div className="bg-surface border border-border rounded-2xl p-6">
                <h3 className="text-[11px] font-medium uppercase tracking-wide text-ink-faint mb-5">
                  {userTeam ? 'Your team' : 'League standings'}
                </h3>

                {userTeam ? (
                  <div className="space-y-6">
                    <div className="flex items-center gap-3">
                      <img src={userTeam.logo_url} className="w-11 h-11 rounded-lg border border-border bg-surface-2 object-cover" />
                      <div>
                        <p className="font-display font-semibold text-ink leading-none mb-1">{userTeam.name}</p>
                        <p className="text-[11px] text-ink-faint">{teamSquad.length} signed</p>
                      </div>
                    </div>

                    <div className="bg-surface-2 p-4 rounded-xl">
                      <div className="flex justify-between items-center mb-1">
                        <p className="text-[10px] text-ink-faint uppercase tracking-wide">Available funds</p>
                        <Wallet className="w-3.5 h-3.5 text-accent" />
                      </div>
                      <p className="tnum text-2xl font-semibold text-accent">
                        {userTeam.total_budget - userTeam.points_spent} <span className="text-xs text-ink-faint">VFL</span>
                      </p>
                    </div>

                    <div className="space-y-2">
                      <p className="text-[10px] font-medium text-ink-faint uppercase tracking-wide">Recent picks</p>
                      {teamSquad.slice(0, 3).map(p => (
                        <div key={p.id} className="flex justify-between items-center py-2 border-b border-border last:border-0">
                          <span className="text-sm text-ink">{p.name}</span>
                          <span className="tnum text-sm text-accent">{p.sold_price}</span>
                        </div>
                      ))}
                      {teamSquad.length === 0 && (
                        <p className="text-xs text-ink-faint py-3">No players signed yet.</p>
                      )}
                    </div>

                    <div className="pt-4 border-t border-border space-y-2">
                      <p className="text-[10px] font-medium text-ink-faint uppercase tracking-wide mb-2">Other franchises</p>
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
                  <div className="space-y-2">
                    {allTeams.length > 0 ? (
                      allTeams.map((t, idx) => (
                        <div key={t.id} className="flex justify-between items-center py-2.5 border-b border-border last:border-0">
                          <div className="flex items-center gap-3">
                            <span className="text-xs text-ink-faint w-4 tnum">{idx + 1}</span>
                            <img src={t.logo_url} className="w-6 h-6 rounded object-cover" />
                            <span className="text-sm text-ink">{t.name}</span>
                          </div>
                          <span className="tnum text-sm text-accent">{t.total_budget - t.points_spent}</span>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-10">
                        <div className="w-5 h-5 border-2 border-border-strong border-t-accent rounded-full animate-spin mx-auto" />
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Recent decisions */}
            <div className="bg-surface border border-border rounded-2xl p-6">
              <h3 className="text-[11px] font-medium uppercase tracking-wide text-ink-faint mb-5">Recent decisions</h3>
              <div className="space-y-3">
                {finishedPlayers.slice(0, 4).map(p => (
                  <div key={p.id} className="flex justify-between items-center py-2.5 border-b border-border last:border-0">
                    <div>
                      <p className="text-sm font-medium text-ink leading-none mb-1">{p.name}</p>
                      <p className={cn("text-[10px] uppercase tracking-wide", p.status === 'SOLD' ? 'text-success' : 'text-danger')}>
                        {p.status === 'SOLD' ? (p.teams?.name || 'Franchise') : 'Unsold'}
                      </p>
                    </div>
                    <span className="tnum text-sm text-ink-muted">{p.sold_price || '—'}</span>
                  </div>
                ))}
                {finishedPlayers.length === 0 && (
                  <p className="text-xs text-ink-faint text-center py-8">No results yet.</p>
                )}
              </div>
            </div>

            {/* Top bids */}
            <div className="bg-surface border border-border rounded-2xl p-6">
              <h3 className="text-[11px] font-medium uppercase tracking-wide text-ink-faint mb-5 flex items-center justify-between">
                Top sales
                <Trophy className="w-3.5 h-3.5 text-accent" />
              </h3>
              <div className="space-y-3">
                {finishedPlayers
                  .filter(p => p.status === 'SOLD')
                  .sort((a, b) => (b.sold_price || 0) - (a.sold_price || 0))
                  .slice(0, 3)
                  .map((p, idx) => (
                  <div key={p.id} className="flex justify-between items-center py-2.5 border-b border-border last:border-0">
                    <div className="flex items-center gap-2.5">
                      <span className="tnum text-xs text-ink-faint">{idx + 1}</span>
                      <div>
                        <p className="text-sm font-medium text-ink leading-none mb-1">{p.name}</p>
                        <p className="text-[10px] text-ink-faint">{p.teams?.name}</p>
                      </div>
                    </div>
                    <span className="tnum text-sm text-accent">{p.sold_price}</span>
                  </div>
                ))}
                {finishedPlayers.filter(p => p.status === 'SOLD').length === 0 && (
                  <p className="text-xs text-ink-faint text-center py-8">No sales yet.</p>
                )}
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-base text-ink font-sans">
      <header className="bg-base/95 backdrop-blur-sm sticky top-0 z-50 border-b border-border">
        <div className="flex justify-between items-center w-full px-6 py-4 max-w-screen-2xl mx-auto">
          <span className="font-display font-semibold text-sm text-ink-muted">VFL Arena</span>
        </div>
      </header>

      <main className="max-w-screen-2xl mx-auto px-6 py-8 pb-32">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 gap-4">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-danger animate-pulse" />
              <span className="text-[11px] font-medium uppercase tracking-wide text-danger">Live</span>
            </div>
            <h1 className="font-display text-3xl md:text-5xl font-bold tracking-tight text-ink">{activePlayer.name}</h1>
          </div>
          <div className="w-full max-w-md bg-surface p-3.5 rounded-xl border border-border">
            {userTeam ? (
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2.5">
                  <img src={userTeam.logo_url} className="w-7 h-7 rounded-full border border-border" />
                  <span className="text-sm font-medium text-ink">{userTeam.name}</span>
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-ink-faint uppercase tracking-wide">Budget left</p>
                  <p className="tnum text-sm font-semibold text-accent">{(userTeam.total_budget || 100) - (userTeam.points_spent || 0)} VFL</p>
                </div>
              </div>
            ) : (
              <div className="flex justify-between items-center">
                <span className="text-xs text-ink-faint uppercase tracking-wide">Session</span>
                <span className="text-sm font-medium text-accent">{session?.status}</span>
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left: details + activity */}
          <div className="lg:col-span-3 space-y-5 order-2 lg:order-1">
            <div className="bg-surface p-5 rounded-xl border border-border">
              <h3 className="text-[11px] font-medium uppercase tracking-wide text-ink-faint mb-4">Details</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="block text-[10px] text-ink-faint uppercase tracking-wide">Year</span>
                  <span className="text-sm text-ink">{activePlayer.year || 'N/A'}</span>
                </div>
                <div>
                  <span className="block text-[10px] text-ink-faint uppercase tracking-wide">Tier</span>
                  <span className="text-sm text-ink">{activePlayer.tier}</span>
                </div>
                <div>
                  <span className="block text-[10px] text-ink-faint uppercase tracking-wide">Position</span>
                  <span className="text-sm text-ink">{activePlayer.department || activePlayer.position}</span>
                </div>
                <div>
                  <span className="block text-[10px] text-ink-faint uppercase tracking-wide">Base</span>
                  <span className="tnum text-sm text-accent">{activePlayer.base_price} VFL</span>
                </div>
              </div>
            </div>

            <div className="bg-surface p-5 rounded-xl border border-border max-h-[380px] overflow-y-auto">
              <h3 className="text-[11px] font-medium uppercase tracking-wide text-ink-faint mb-4">Bid activity</h3>
              <div className="space-y-3">
                {bids.length > 0 ? bids.map((bid, index) => (
                  <div
                    key={bid.id}
                    className={cn(
                      "flex justify-between items-center pb-3 border-b border-border last:border-0",
                      index === 0 && "text-accent"
                    )}
                  >
                    <div className="flex flex-col">
                      <span className={cn("text-[10px] font-medium uppercase tracking-wide", index === 0 ? "text-accent" : "text-ink-faint")}>
                        {index === 0 ? 'Highest' : 'Outbid'}
                      </span>
                      <span className="text-sm text-ink">{bid.teams?.name || 'Team'}</span>
                    </div>
                    <span className={cn("tnum text-base font-medium", index === 0 ? "text-accent" : "text-ink-muted")}>
                      {bid.amount}
                    </span>
                  </div>
                )) : (
                  <div className="text-center py-6 text-ink-faint text-xs">No bids yet</div>
                )}
              </div>
            </div>
          </div>

          {/* Center: player visual */}
          <div className="lg:col-span-6 flex flex-col items-center justify-center order-1 lg:order-2">
            <div className={cn(
              "tier-stripe w-full max-w-[420px] aspect-[3.5/5] rounded-2xl overflow-hidden relative border border-border transition-all duration-500",
              activePlayer.tier === 'GOLD' ? 'tier-stripe--gold' : activePlayer.tier === 'SILVER' ? 'tier-stripe--silver' : 'tier-stripe--bronze',
              (activePlayer.status === 'SOLD' || activePlayer.status === 'UNSOLD') && "opacity-60"
            )}>
              <img
                alt={activePlayer.name}
                className="w-full h-full object-cover grayscale-[0.2]"
                src={activePlayer.photo_url || 'https://images.unsplash.com/photo-1543326727-cf6c39e8f84c?q=80&w=1470&auto=format&fit=crop'}
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-base via-base/10 to-transparent" />

              <AnimatePresence>
                {(activePlayer.status === 'SOLD' || activePlayer.status === 'UNSOLD') && (
                  <div className="absolute inset-0 z-30 flex items-center justify-center bg-base/50 backdrop-blur-[2px] overflow-hidden">
                    <motion.div
                      initial={{ scale: 0.3, opacity: 0.6 }}
                      animate={{ scale: 2.2, opacity: 0 }}
                      transition={{ duration: 1.1, ease: 'easeOut' }}
                      className={cn(
                        "absolute w-40 h-40 rounded-full",
                        activePlayer.status === 'SOLD' ? "bg-success" : "bg-danger"
                      )}
                    />
                    <motion.div
                      initial={{ scale: 0.4, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ type: 'spring', stiffness: 260, damping: 16, bounce: 0.4 }}
                      className={cn(
                        "relative px-8 py-3 rounded-lg font-hype text-3xl uppercase tracking-wide",
                        activePlayer.status === 'SOLD' ? "bg-success text-success-ink" : "bg-danger text-danger-ink"
                      )}
                    >
                      {activePlayer.status === 'SOLD' ? 'Sold' : 'Unsold'}
                    </motion.div>
                  </div>
                )}
              </AnimatePresence>

              <div className="absolute bottom-0 inset-x-0 p-6 flex flex-col items-center text-center bg-gradient-to-t from-base via-base/60 to-transparent">
                <h2 className="font-hype text-4xl lg:text-5xl text-ink mb-4 uppercase tracking-wide">{activePlayer.name}</h2>
                <div className="flex items-center gap-6">
                  <div className="flex flex-col items-center">
                    <span className="text-[10px] uppercase tracking-wide text-ink-faint mb-1">Base</span>
                    <span className="tnum text-lg font-semibold text-ink">{activePlayer.base_price}</span>
                  </div>
                  <div className="w-px h-7 bg-border" />
                  <div className="flex flex-col items-center overflow-hidden">
                    <span className="text-[10px] uppercase tracking-wide text-accent mb-1">Latest</span>
                    <AnimatePresence mode="popLayout">
                      <motion.span
                        key={bids[0]?.amount ?? 'none'}
                        initial={{ y: 16, opacity: 0, scale: 1.3 }}
                        animate={{ y: 0, opacity: 1, scale: 1 }}
                        exit={{ y: -16, opacity: 0 }}
                        transition={{ type: 'spring', stiffness: 400, damping: 22 }}
                        className="tnum text-2xl font-bold text-accent block"
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
            <div className="bg-surface p-5 rounded-xl border border-border">
              <h3 className="text-[11px] font-medium uppercase tracking-wide text-ink-faint mb-5">
                {userTeamId ? (bids.length === 0 ? 'Open the bidding' : 'Raise the bid') : 'Spectator view'}
              </h3>

              {timeLeft !== null && (
                <div className="mb-5 bg-surface-2 rounded-xl p-3.5 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <motion.div
                      animate={timeLeft <= 10 ? { scale: [1, 1.12, 1] } : { scale: 1 }}
                      transition={timeLeft <= 10 ? { duration: 0.8, repeat: Infinity, ease: 'easeInOut' } : {}}
                      className={cn(
                        "tnum w-10 h-10 rounded-full border-2 flex items-center justify-center text-base font-semibold",
                        timeLeft <= 10 ? "border-danger text-danger" : "border-accent text-accent"
                      )}
                    >
                      {timeLeft}
                    </motion.div>
                    <div>
                      <p className="text-[10px] font-medium uppercase tracking-wide text-ink-muted leading-none mb-1">Time left</p>
                      <p className="text-[10px] text-ink-faint">Synced for everyone</p>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex flex-col gap-2.5">
                {!userTeamId ? (
                  <div className="bg-surface-2 p-6 rounded-xl flex flex-col items-center gap-3 text-center">
                    <Users className="w-6 h-6 text-ink-faint" />
                    <div>
                      <span className="text-xs font-medium text-ink-muted">Viewer access</span>
                      <p className="text-xs text-ink-faint mt-1.5">Only team franchises can bid. Enjoy the broadcast.</p>
                    </div>
                  </div>
                ) : bids.length === 0 ? (
                  <button
                    disabled={isBidding || session?.status !== 'LIVE'}
                    onClick={() => handleBid(1)}
                    className="w-full bg-accent hover:bg-accent-hover text-accent-ink p-6 rounded-xl transition-colors disabled:opacity-50"
                  >
                    <div className="flex flex-col items-center gap-1">
                      <span className="text-xs font-medium uppercase tracking-wide opacity-80">Open bid</span>
                      <span className="font-display text-3xl font-bold">{activePlayer.base_price} VFL</span>
                    </div>
                  </button>
                ) : (
                  [1, 2, 3, 4, 5].map(increment => {
                    const latestBid = bids[0];
                    const isLeading = userTeamId && latestBid?.team_id === userTeamId;
                    const nextAmount = (latestBid?.amount || activePlayer.base_price) + increment;

                    return (
                      <button
                        key={increment}
                        disabled={isBidding || session?.status !== 'LIVE' || isLeading}
                        onClick={() => handleBid(increment)}
                        className={cn(
                          "flex items-center justify-between p-3 rounded-lg border transition-colors disabled:opacity-40 disabled:cursor-not-allowed",
                          isLeading ? "bg-surface-2 border-border" : "bg-surface-2 hover:bg-surface-3 border-border hover:border-border-strong"
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-lg bg-surface-3 flex items-center justify-center tnum text-sm font-semibold text-accent">
                            +{increment}
                          </div>
                          <div className="text-left">
                            <span className="block text-xs font-medium text-ink">Raise</span>
                            <span className="block text-[10px] text-ink-faint">Next {nextAmount} VFL</span>
                          </div>
                        </div>
                        <Plus className="w-3.5 h-3.5 text-ink-faint" />
                      </button>
                    );
                  })
                )}
              </div>

              {isBidding && (
                <div className="mt-4 pt-4 border-t border-border flex items-center justify-center gap-2 text-xs text-ink-faint">
                  <div className="w-3.5 h-3.5 border-2 border-border-strong border-t-accent rounded-full animate-spin" />
                  Submitting
                </div>
              )}
            </div>

            <div className="bg-surface p-5 rounded-xl border border-border space-y-5">
              <div>
                <h3 className="text-[11px] font-medium uppercase tracking-wide text-ink-faint mb-3">Franchise budgets</h3>
                <div className="grid grid-cols-2 gap-2">
                  {allTeams.map(t => (
                    <div key={t.id} className={cn(
                      "p-2.5 rounded-lg",
                      userTeamId === t.id ? "bg-accent/10" : "bg-surface-2"
                    )}>
                      <div className="text-[10px] text-ink-faint truncate mb-0.5">{t.name}</div>
                      <p className="tnum text-xs font-medium text-ink">{(t.total_budget || 100) - (t.points_spent || 0)}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-[11px] font-medium uppercase tracking-wide text-ink-faint mb-3">Recent sales</h3>
                <div className="space-y-2">
                  {finishedPlayers.filter(p => p.status === 'SOLD').slice(0, 2).map(p => (
                    <div key={p.id} className="flex justify-between items-center py-1.5">
                      <div>
                        <p className="text-xs font-medium text-ink leading-none mb-1">{p.name}</p>
                        <p className="text-[10px] text-ink-faint">{p.teams?.name}</p>
                      </div>
                      <span className="tnum text-xs text-ink-muted">{p.sold_price}</span>
                    </div>
                  ))}
                  {finishedPlayers.filter(p => p.status === 'SOLD').length === 0 && (
                    <p className="text-[11px] text-ink-faint text-center py-2">None yet</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      <AnimatePresence>
        {outbidToast && (
          <motion.div
            initial={{ x: 100, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 100, opacity: 0 }}
            className="fixed bottom-24 right-6 z-50 max-w-sm w-full"
          >
            <div className="bg-surface border border-danger/30 p-4 rounded-xl shadow-xl flex gap-3 items-start">
              <div className="bg-danger/10 p-2 rounded-lg">
                <AlertTriangle className="w-4 h-4 text-danger" />
              </div>
              <div className="flex flex-col flex-1">
                <span className="text-sm font-medium text-ink">You've been outbid</span>
                <span className="text-xs text-ink-muted mt-0.5">A higher bid landed for {activePlayer.name}.</span>
              </div>
              <button onClick={() => setOutbidToast(false)} className="text-ink-faint hover:text-ink transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {sellAnimation && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-6 pointer-events-none bg-base/70 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.94, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.98, opacity: 0 }}
              className="bg-surface border border-border p-10 rounded-2xl w-full max-w-sm text-center"
            >
              <span className={cn(
                "inline-block px-4 py-1.5 rounded-full text-xs font-semibold uppercase tracking-wide mb-5",
                sellAnimation.type === 'SOLD' ? "bg-success text-success-ink" : "bg-danger text-danger-ink"
              )}>
                {sellAnimation.type}
              </span>
              <h2 className="font-display text-3xl font-bold text-ink mb-3">
                {sellAnimation.player.name}
              </h2>
              {sellAnimation.type === 'SOLD' && (
                <p className="tnum text-lg text-accent">
                  {sellAnimation.player.sold_price} VFL
                </p>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

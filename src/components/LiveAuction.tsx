import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import { Bell, Wallet, PlusCircle, AlertTriangle, X, Loader2, Star, Users } from 'lucide-react';
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
           setTimeout(() => setSellAnimation(null), 5000);
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

  // Timer Logic (P2 Fix)
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

    // Always fetch context for Intermission Dashboard
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
    
    // Sequential self-healing auth check
    let effectiveTeamId = userTeamId;
    let effectiveTeam = userTeam;
    
    if (user && (!effectiveTeamId || !effectiveTeam)) {
       // 1. Fetch profile by email as a baseline
       const { data: profile } = await supabase.from('users')
          .select('id, team_id, role')
          .ilike('email', user.email || '')
          .maybeSingle();
       
       if (profile) {
         effectiveTeamId = profile.team_id;
         
         if (effectiveTeamId) {
            // 2. Fetch team data separately to avoid JOINS that might fail
            const { data: teamData } = await supabase.from('teams')
               .select('*')
               .eq('id', effectiveTeamId)
               .maybeSingle();
            
            effectiveTeam = teamData;
         }
         
         // Update states for future clicks
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
      // 1. Calculate suggested amount
      const currentHighest = bids.length > 0 ? bids[0].amount : (activePlayer.base_price - 1);
      const bidAmount = currentHighest + increment;

      // 2. Call the Serverless API instead of direct RPC
      const response = await fetch('/api/bids', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playerId: activePlayer.id,
          teamId: effectiveTeamId,
          amount: bidAmount,
          increment_used: increment,
          userId: user.id // Pass user ID for verification
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

      // 3. Success! The Real-time listener will sync the UI for everyone
      console.log("🔥 BID ACCEPTED:", result.new_amount);
      
    } catch (err: any) {
      console.error('Bid failed:', err.message);
      alert(err.message || "Failed to transmit bid to the Arena.");
    } finally {
      setIsBidding(false);
    }
  }

  if (loading) return <div className="min-h-screen bg-surface flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  if (!activePlayer) {
    const remainingBudget = userTeam ? (userTeam.total_budget - userTeam.points_spent) : 100;

    return (
      <div className="min-h-screen bg-surface p-6">
        <header className="max-w-screen-2xl mx-auto flex justify-between items-center mb-12">
           <div className="text-2xl font-black italic tracking-tighter text-primary font-headline uppercase text-glow">VFL Arena</div>
           <div className="flex items-center gap-4">
              <span className="text-[10px] font-black uppercase text-white/20 tracking-widest leading-none">Market Status</span>
              <div className="bg-primary/10 border border-primary/20 px-3 py-1 rounded-full flex items-center gap-2">
                 <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></span>
                 <span className="text-[10px] font-black italic uppercase text-primary">Intermission</span>
              </div>
           </div>
        </header>

        <main className="max-w-6xl mx-auto space-y-12">
           <div className="text-center">
              <h2 className="text-5xl md:text-7xl font-headline font-black italic tracking-tighter uppercase mb-4 opacity-20">Spotlight Pending</h2>
              <p className="text-white/40 font-label text-xs uppercase tracking-[0.4em]">Waiting for the Marshall to spotlight the next legend...</p>
           </div>

           <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {/* My Team Box */}
              <div className="md:col-span-1 space-y-4">
                 <div className="bg-[#0c0c1e]/80 p-6 rounded-[2rem] border border-white/5 backdrop-blur-3xl shadow-2xl relative overflow-hidden group">
                   {/* Background Gradient */}
                   <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-[60px]"></div>

                   <h3 className="text-[10px] font-black uppercase text-primary tracking-[0.3em] mb-8 flex items-center gap-2">
                      <div className="w-1 h-1 rounded-full bg-primary animate-pulse"></div>
                      {userTeam ? 'Command Post' : 'League Purse Status'}
                   </h3>

                   {userTeam ? (
                      <div className="space-y-8 relative z-10">
                         <div className="flex items-center gap-5">
                            <div className="relative">
                               <div className="absolute inset-0 bg-primary/20 blur-[15px] rounded-full scale-125"></div>
                               <img src={userTeam.logo_url} className="w-16 h-16 rounded-[1.5rem] border-2 border-white/10 bg-black/40 p-2 relative z-10" />
                            </div>
                            <div>
                               <p className="text-2xl font-headline font-black italic uppercase text-white tracking-tighter leading-none mb-2">{userTeam.name}</p>
                               <div className="flex items-center gap-2">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                                  <p className="text-[9px] font-black italic text-white/40 uppercase tracking-widest leading-none">{teamSquad.length} Legends Signed</p>
                               </div>
                            </div>
                         </div>

                         <div className="grid grid-cols-1 gap-4">
                            <div className="bg-white/[0.03] p-5 rounded-3xl border border-white/5 group-hover:bg-white/[0.05] transition-colors">
                               <div className="flex justify-between items-center mb-1">
                                  <p className="text-[10px] text-white/40 uppercase font-black tracking-widest">Available Funds</p>
                                  <Wallet className="w-3.5 h-3.5 text-primary opacity-40" />
                               </div>
                               <p className="text-4xl font-headline font-black italic text-primary leading-tight tracking-tighter">
                                  {userTeam.total_budget - userTeam.points_spent} <span className="text-xs tracking-normal font-label not-italic opacity-40">VFL</span>
                               </p>
                            </div>
                         </div>

                         <div className="space-y-3">
                            <p className="text-[9px] font-black text-white/20 uppercase tracking-[0.3em] mb-2 px-1">Recent Drafting</p>
                            {teamSquad.slice(0, 3).map(p => (
                               <div key={p.id} className="flex justify-between items-center bg-white/[0.02] p-4 rounded-2xl border border-white/5 hover:border-white/10 transition-all group/p">
                                  <div className="flex items-center gap-3">
                                     <div className="w-1 h-8 bg-primary/20 rounded-full group-hover/p:bg-primary/60 transition-colors"></div>
                                     <span className="font-headline font-black italic uppercase text-white text-xs tracking-widest">{p.name}</span>
                                  </div>
                                  <span className="font-headline font-black italic text-primary text-sm">{p.sold_price}</span>
                               </div>
                            ))}
                            {teamSquad.length === 0 && (
                               <div className="text-center py-6 border-2 border-dashed border-white/5 rounded-3xl">
                                  <p className="text-[10px] italic text-white/20 font-black uppercase tracking-widest">No Draft Signals Picked Up</p>
                               </div>
                            )}
                         </div>

                         {/* Competitor Purse Watch for Captains */}
                         <div className="mt-8 pt-8 border-t border-white/5">
                            <h3 className="text-[10px] font-black uppercase text-white/30 tracking-[0.3em] mb-4 flex items-center justify-between px-1">
                               <span>Competitor War Chests</span>
                               <Users className="w-3.5 h-3.5 text-primary opacity-40" />
                            </h3>
                            <div className="space-y-2 max-h-[160px] overflow-y-auto pr-2 custom-scrollbar">
                               {allTeams.filter(t => t.id !== userTeam.id).map(t => (
                                  <div key={t.id} className="flex justify-between items-center p-3 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-white/10 transition-all">
                                     <div className="flex items-center gap-2">
                                       <div className="w-1.5 h-1.5 rounded-full bg-white/10"></div>
                                       <span className="text-[9px] font-black uppercase tracking-widest text-white/60 truncate max-w-[100px]">{t.name}</span>
                                     </div>
                                     <span className="text-xs font-headline font-black italic text-primary leading-none">{(t.total_budget || 100) - (t.points_spent || 0)} <span className="text-[7px] font-label not-italic opacity-40">VFL</span></span>
                                  </div>
                               ))}
                            </div>
                         </div>
                      </div>
                   ) : (
                      <div className="space-y-4">
                         {allTeams.length > 0 ? (
                            allTeams.map((t, idx) => (
                               <div key={t.id} className="flex justify-between items-center p-4 bg-white/[0.02] rounded-2xl border border-white/5 hover:border-white/10 transition-all group/row">
                                  <div className="flex items-center gap-3">
                                     <span className="text-[10px] font-black italic text-white/10 w-4 font-headline">{idx + 1}</span>
                                     <img src={t.logo_url} className="w-8 h-8 rounded-lg opacity-40 group-hover/row:opacity-100 transition-opacity" />
                                     <span className="text-xs font-headline font-black italic uppercase text-white tracking-widest">{t.name}</span>
                                  </div>
                                  <div className="text-right">
                                     <p className="text-xs font-headline font-black italic text-primary">{t.total_budget - t.points_spent} VFL</p>
                                  </div>
                               </div>
                            ))
                         ) : (
                            <div className="text-center py-12">
                               <Loader2 className="w-5 h-5 animate-spin mx-auto text-primary" />
                            </div>
                         )}
                         <p className="text-[8px] text-center text-white/20 uppercase mt-4 tracking-widest leading-relaxed">Join a franchise to view your personal status</p>
                      </div>
                   )}
                </div>
              </div>

               {/* Pillar 2: Activity Center (Recent Logs) */}
               <div className="bg-white/5 p-8 rounded-[2rem] border border-white/5 backdrop-blur-md h-full">
                  <h3 className="text-[10px] font-black uppercase text-white/30 tracking-[0.4em] mb-8 flex justify-between items-center">
                     <span>Recent Decisions</span>
                     {finishedPlayers.length > 0 && <span className="bg-white/5 px-3 py-1 rounded-full text-[8px] italic">{finishedPlayers.length} LOGS</span>}
                  </h3>
                  <div className="space-y-4">
                     {finishedPlayers.slice(0, 4).map(p => (
                        <div key={p.id} className="p-5 rounded-[1.5rem] bg-black/40 border border-white/5 hover:border-primary/20 transition-all relative group overflow-hidden">
                           <div className="flex justify-between items-center relative z-10">
                              <div>
                                 <p className="text-sm font-headline font-black uppercase italic text-white leading-none mb-2">{p.name}</p>
                                 <p className={cn(
                                     "text-[9px] font-black uppercase tracking-[0.2em] flex items-center gap-2",
                                     p.status === 'SOLD' ? 'text-emerald-500' : 'text-error'
                                  )}>
                                    <span className={cn("w-1 h-1 rounded-full", p.status === 'SOLD' ? 'bg-emerald-500 animate-pulse' : 'bg-error')}></span>
                                    {p.status === 'SOLD' ? `${p.teams?.name || 'Franchise'}` : 'Unsold'}
                                 </p>
                              </div>
                              <div className="text-right">
                                 <p className="text-xl font-headline font-black italic text-primary leading-none tracking-tighter">{p.sold_price || '—'}</p>
                                 <p className="text-[8px] text-white/20 font-black uppercase mt-1 tracking-widest leading-none">Sold At</p>
                              </div>
                           </div>
                        </div>
                     ))}
                     {finishedPlayers.length === 0 && (
                        <div className="text-center py-20 bg-black/20 rounded-[2rem] border-2 border-dashed border-white/5">
                           <p className="text-[10px] font-black italic text-white/20 uppercase tracking-[0.3em]">Awaiting Outcome...</p>
                        </div>
                     )}
                  </div>
               </div>

               {/* Pillar 3: Hall of Fame (Top 3 Bids) */}
               <div className="bg-white/5 p-8 rounded-[2rem] border border-white/5 backdrop-blur-md h-full">
                  <h3 className="text-[10px] font-black uppercase text-white/30 tracking-[0.4em] mb-8 flex justify-between items-center">
                     <span>Elite Signatures</span>
                     <Star className="w-3 h-3 text-primary" />
                  </h3>
                  <div className="space-y-4">
                     {finishedPlayers
                        .filter(p => p.status === 'SOLD')
                        .sort((a, b) => (b.sold_price || 0) - (a.sold_price || 0))
                        .slice(0, 3)
                        .map((p, idx) => (
                        <div key={p.id} className="relative p-5 rounded-[1.5rem] bg-gradient-to-br from-primary/10 to-transparent border border-primary/20 group">
                           <span className="absolute -top-2 -right-2 w-6 h-6 bg-primary text-surface font-black italic text-xs rounded-full flex items-center justify-center shadow-[0_0_15px_rgba(255,183,1,0.5)]">#{idx + 1}</span>
                           <div className="flex justify-between items-center">
                              <div>
                                 <p className="text-sm font-headline font-black uppercase italic text-white leading-none mb-1">{p.name}</p>
                                 <p className="text-[8px] font-black uppercase text-primary tracking-widest italic">{p.teams?.name}</p>
                              </div>
                              <div className="text-right">
                                 <p className="text-xl font-headline font-black italic text-white leading-none tracking-tighter">{p.sold_price}</p>
                                 <p className="text-[8px] text-white/40 font-black uppercase mt-1 tracking-widest leading-none">Premium</p>
                              </div>
                           </div>
                        </div>
                     ))}
                     {finishedPlayers.filter(p => p.status === 'SOLD').length === 0 && (
                        <p className="text-[10px] italic text-white/20 text-center py-20 uppercase tracking-[0.2em] bg-black/10 rounded-[2rem]">No Hall of Fame entries yet</p>
                     )}
                  </div>
               </div>
            </div>
         </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface text-white font-body selection:bg-primary selection:text-surface">
      {/* Top Navigation */}
      <header className="bg-black/80 backdrop-blur-xl sticky top-0 z-50 border-b border-white/5">
        <div className="flex justify-between items-center w-full px-6 py-4 max-w-screen-2xl mx-auto">
           <div className="text-2xl font-black italic tracking-tighter text-primary font-headline uppercase text-glow">VFL Arena</div>
        </div>
      </header>

      <main className="max-w-screen-2xl mx-auto px-6 py-8 pb-32">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 gap-4">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2 bg-error/10 border border-error/20 px-3 py-1 rounded-full w-fit">
              <span className="w-2 h-2 rounded-full bg-error animate-pulse shadow-[0_0_8px_rgba(255,107,107,0.5)]"></span>
              <span className="text-[10px] font-label uppercase tracking-widest font-bold text-error">Arena Live</span>
            </div>
            <h1 className="text-4xl md:text-6xl font-headline font-black tracking-tighter uppercase italic">{activePlayer.name}</h1>
          </div>
          <div className="w-full max-w-md flex flex-col gap-2 bg-white/5 p-4 rounded-xl border border-white/5">
            {userTeam ? (
              <div className="flex justify-between items-center mb-1">
                 <div className="flex items-center gap-3">
                    <img src={userTeam.logo_url} className="w-8 h-8 rounded-full border border-primary/20" />
                    <span className="text-xs font-black uppercase text-white tracking-widest leading-none">{userTeam.name}</span>
                 </div>
                 <div className="flex items-center gap-4">
                    <div className="text-right">
                       <p className="text-[9px] text-white/20 uppercase font-black">Budget Left</p>
                       <p className="text-sm font-black text-primary">{(userTeam.total_budget || 100) - (userTeam.points_spent || 0)} <span className="text-[9px]">VFL</span></p>
                    </div>
                 </div>
              </div>
            ) : (
              <div className="flex justify-between items-end font-label">
                <span className="text-xs text-white/40 uppercase tracking-widest">Session Status</span>
                <span className="text-xl font-bold text-primary italic uppercase">{session?.status}</span>
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Stats & History */}
          <div className="lg:col-span-3 space-y-6 order-2 lg:order-1">
            <div className="bg-white/5 backdrop-blur-md p-6 rounded-xl border border-white/5">
              <h3 className="font-label text-xs uppercase tracking-[0.2em] text-white/40 mb-4 flex items-center gap-2">
                <span className="w-1 h-3 bg-primary rounded-full"></span> Details
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col">
                  <span className="text-[10px] text-white/20 uppercase font-bold tracking-widest">Year</span>
                  <span className="font-label font-bold text-white">{activePlayer.year || 'N/A'}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] text-white/20 uppercase font-bold tracking-widest">Tier</span>
                  <span className="font-label font-bold text-white">{activePlayer.tier}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] text-white/20 uppercase font-bold tracking-widest">Position</span>
                  <span className="font-label font-bold text-white">{activePlayer.department || activePlayer.position}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] text-white/20 uppercase font-bold tracking-widest">Base</span>
                  <span className="font-label font-bold text-white text-primary">{activePlayer.base_price} VFL</span>
                </div>
              </div>
            </div>
            <div className="bg-white/5 backdrop-blur-md p-6 rounded-xl border border-white/5 max-h-[400px] overflow-y-auto">
              <h3 className="font-label text-xs uppercase tracking-[0.2em] text-white/40 mb-4">Activity Stream</h3>
              <div className="space-y-4">
                {bids.length > 0 ? bids.map((bid, index) => (
                  <div 
                    key={bid.id} 
                    className={cn(
                      "flex justify-between items-center border-b border-white/5 pb-2 animate-in fade-in slide-in-from-left-2",
                      index === 0 && "bg-primary/5 p-2 rounded-lg border-primary/20"
                    )}
                  >
                    <div className="flex flex-col">
                      <span className={cn("text-xs font-bold font-label uppercase", index === 0 ? "text-primary" : "text-white")}>
                        {index === 0 ? '🏆 HIGHEST BID' : 'BID PLACED'}
                      </span>
                      <span className="text-[10px] font-black text-white/60 uppercase">{bid.teams?.name || 'Team'}</span>
                      <span className="text-[9px] text-white/20">{new Date(bid.created_at).toLocaleTimeString()}</span>
                    </div>
                    <span className={cn("font-bold font-label text-lg", index === 0 ? "text-primary" : "text-white/60")}>
                       {bid.amount} VFL
                    </span>
                  </div>
                )) : (
                  <div className="text-center py-4 text-white/20 font-label text-xs uppercase tracking-widest">No bids yet</div>
                )}
              </div>
            </div>
          </div>

          {/* Player Visual */}
          <div className="lg:col-span-6 flex flex-col items-center justify-center relative order-1 lg:order-2">

            <div className={cn(
              "w-full max-w-[440px] aspect-[3.5/5] rounded-2xl overflow-hidden relative group transition-all duration-500",
              activePlayer.tier === 'GOLD' ? 'tier-gold-glow' : activePlayer.tier === 'SILVER' ? 'tier-silver-glow' : 'tier-bronze-glow',
              (activePlayer.status === 'SOLD' || activePlayer.status === 'UNSOLD') && "scale-95 grayscale opacity-50"
            )}>
              <img 
                alt={activePlayer.name} 
                className="w-full h-full object-cover grayscale-[0.3] group-hover:grayscale-0 transition-all duration-700" 
                src={activePlayer.photo_url || 'https://images.unsplash.com/photo-1543326727-cf6c39e8f84c?q=80&w=1470&auto=format&fit=crop'}
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-surface via-transparent to-transparent opacity-95"></div>
              
              {/* Status Overlay */}
              {activePlayer.status === 'SOLD' && (
                <div className="absolute inset-0 z-30 flex items-center justify-center bg-emerald-500/20 backdrop-blur-sm animate-in zoom-in-95">
                   <div className="p-8 bg-black/80 border-4 border-emerald-500 rounded-full shadow-[0_0_50px_rgba(16,185,129,0.5)] -rotate-12">
                      <span className="text-6xl font-black font-headline text-emerald-500 italic tracking-tighter uppercase px-4 inline-block">SOLD!</span>
                   </div>
                </div>
              )}
              {activePlayer.status === 'UNSOLD' && (
                <div className="absolute inset-0 z-30 flex items-center justify-center bg-error/20 backdrop-blur-sm animate-in zoom-in-95">
                   <div className="p-8 bg-black/80 border-4 border-error rounded-full shadow-[0_0_50px_rgba(239,68,68,0.5)] -rotate-12">
                      <span className="text-6xl font-black font-headline text-error italic tracking-tighter uppercase px-4 inline-block text-glow">UNSOLD</span>
                   </div>
                </div>
              )}
              <div className="absolute bottom-0 inset-x-0 p-8 flex flex-col items-center text-center bg-gradient-to-t from-black via-black/40 to-transparent">
                <div className="px-3 py-1 rounded-full border border-white/10 bg-black/40 backdrop-blur-md mb-4 inline-flex items-center gap-2">
                   <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></div>
                   <span className="font-label text-[9px] font-black uppercase tracking-[0.4em] text-white">Digital Colosseum Live</span>
                </div>
                <h2 className="font-headline text-5xl lg:text-6xl font-black italic tracking-tighter uppercase leading-none mb-4 text-white text-glow drop-shadow-2xl">{activePlayer.name}</h2>
                <div className="flex items-center gap-8 translate-y-2 opacity-80 scale-90">
                   <div className="flex flex-col items-center">
                      <span className="text-[9px] font-black uppercase tracking-widest text-white/40 font-label mb-1">Base</span>
                      <span className="font-headline text-xl font-black italic">{activePlayer.base_price}</span>
                   </div>
                   <div className="w-px h-8 bg-white/10"></div>
                   <div className="flex flex-col items-center">
                      <span className="text-[9px] font-black uppercase tracking-widest text-primary font-label mb-1">Latest Call</span>
                      <span className="font-headline text-3xl font-black italic text-primary text-glow">{bids[0]?.amount || '-'}</span>
                   </div>
                </div>
              </div>
            </div>
          </div>
{/* Bid Controls & Market Intel */}
          <div className="lg:col-span-3 space-y-4 order-3">
             <div className="bg-surface-container-high/40 backdrop-blur-2xl p-6 rounded-2xl border border-white/5 shadow-2xl overflow-hidden relative group">
                {/* Dynamic Header */}
                <h3 className="font-label text-[10px] font-black uppercase tracking-[0.3em] text-white/40 mb-6 flex justify-between items-center">
                   <span>{userTeamId ? (bids.length === 0 ? 'Initialize Draft' : 'Raise The Stakes') : 'Arena Spectator Feed'}</span>
                </h3>

                {/* Integrated Hammer Timer */}
                {timeLeft !== null && (
                   <div className="mb-6 bg-black/40 rounded-2xl p-4 border border-white/5 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                         <div className={cn(
                            "w-12 h-12 rounded-full border-4 flex items-center justify-center font-headline text-xl font-black italic transition-colors",
                            timeLeft <= 10 ? "border-error text-error animate-pulse shadow-[0_0_20px_rgba(239,68,68,0.4)]" : "border-primary text-primary"
                         )}>
                            {timeLeft}
                         </div>
                         <div>
                            <p className="text-[10px] font-black uppercase text-white/40 tracking-[0.2em] leading-none mb-1">Hammer Timing</p>
                            <p className="text-[8px] font-label italic text-white/20 uppercase tracking-widest">Global Sync Active</p>
                         </div>
                      </div>
                      <div className="text-right">
                         <p className={cn(
                            "text-[10px] font-black uppercase tracking-[0.1em]",
                            timeLeft <= 10 ? "text-error" : "text-primary/60"
                         )}>
                            {timeLeft <= 10 ? 'FINAL CALL' : 'BIDDING WINDOW'}
                         </p>
                      </div>
                   </div>
                )}

                <div className="flex flex-col gap-3">
                   {!userTeamId ? (
                      <div className="bg-black/20 p-8 rounded-2xl border border-white/5 flex flex-col items-center gap-4">
                         <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center text-white/20">
                            <Users className="w-6 h-6" />
                         </div>
                         <div className="text-center">
                            <span className="font-label text-[10px] font-black uppercase tracking-[0.4em] text-white/20">Viewer Access</span>
                            <p className="text-xs text-white/40 font-body mt-2 leading-relaxed">Official franchises only can participate in the live draft. Enjoy the broadcast!</p>
                         </div>
                         <div className="w-full h-px bg-white/5 mt-4"></div>
                         <div className="flex items-center gap-2 text-[8px] font-black uppercase tracking-widest text-primary italic">
                            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></span> Authorized Spectator Only
                         </div>
                      </div>
                   ) : bids.length === 0 ? (
                      <button 
                        disabled={isBidding || session?.status !== 'LIVE'}
                        onClick={() => handleBid(1)}
                        className="w-full relative group overflow-hidden bg-primary hover:bg-gold p-8 rounded-2xl transition-all shadow-[0_0_30px_rgba(255,231,146,0.15)] hover:shadow-[0_0_50px_rgba(255,231,146,0.3)] active:scale-95 disabled:opacity-50"
                      >
                         <div className="relative z-10 flex flex-col items-center gap-2">
                           <span className="font-label text-[10px] font-black uppercase tracking-[0.4em] text-surface/60 group-hover:text-surface underline decoration-vibrant-gold decoration-2 underline-offset-4">Spotlight Ready</span>
                           <span className="font-headline text-5xl font-black italic text-surface tracking-tighter uppercase leading-none">OPEN BID</span>
                           <span className="font-headline text-2xl font-black italic text-surface/80">@ {activePlayer.base_price} VFL</span>
                         </div>
                         <div className="absolute inset-0 bg-gradient-to-tr from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                      </button>
                   ) : (
                      <>
                        {[1, 2, 3, 4, 5].map(increment => {
                           const latestBid = bids[0];
                           const isLeading = userTeamId && latestBid?.team_id === userTeamId;
                           const nextAmount = (latestBid?.amount || activePlayer.base_price) + increment;
                           
                           return (
                           <button
                             key={increment}
                             disabled={isBidding || session?.status !== 'LIVE' || isLeading}
                             onClick={() => handleBid(increment)}
                             className={cn(
                               "group relative flex items-center justify-between p-3 rounded-xl border transition-all active:scale-[0.98] disabled:opacity-50",
                               isLeading ? "bg-white/5 border-white/5 opacity-50 cursor-not-allowed" : "bg-white/5 hover:bg-white/10 hover:border-primary/30 border-white/5"
                             )}
                           >
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-lg bg-surface-container-highest flex items-center justify-center font-headline text-xl font-black italic text-primary group-hover:scale-110 transition-transform">
                                  +{increment}
                                </div>
                                <div className="text-left">
                                  <span className="block font-headline font-bold uppercase text-xs text-white tracking-tight leading-none mb-1">Increase</span>
                                  <span className="block text-[8px] font-label text-white/40 uppercase tracking-wide">Next: {nextAmount} VFL</span>
                                </div>
                              </div>
                              <PlusCircle className="w-4 h-4 text-white/20 group-hover:text-primary transition-all" />
                           </button>
                           );
                        })}
                      </>
                   )}
                </div>
                <div className="mt-8 pt-6 border-t border-white/5">
                   <div className="flex justify-between items-center mb-4">
                      <span className="text-[10px] font-bold text-white/20 uppercase tracking-[0.2em]">Safety Lock</span>
                      {isBidding && <Loader2 className="w-4 h-4 animate-spin text-primary" />}
                   </div>
                   <p className="text-[9px] text-white/20 font-label italic text-center">Bids are final once submitted. Refresh if timer desyncs.</p>
                </div>
             </div>

             {/* League War Chests & Recent Signatures */}
             <div className="bg-white/5 backdrop-blur-md p-6 rounded-2xl border border-white/5 space-y-6">
                <div>
                   <h3 className="text-[10px] font-black uppercase text-primary/60 tracking-[0.3em] mb-4 flex items-center justify-between">
                      <span>Live Purse Watch</span>
                      <Wallet className="w-3 h-3" />
                   </h3>
                   <div className="grid grid-cols-2 gap-2">
                    {allTeams.map(t => (
                         <div key={t.id} className={cn(
                            "p-2 rounded-lg border transition-all",
                            userTeamId === t.id ? "bg-primary/10 border-primary/20" : "bg-black/20 border-white/5"
                         )}>
                            <div className="flex items-center gap-2 mb-1 truncate">
                               <span className={cn("text-[7px] font-black uppercase tracking-widest truncate", userTeamId === t.id ? "text-primary" : "text-white/40")}>{t.name}</span>
                            </div>
                            <p className="text-xs font-headline font-black italic tracking-tight">{(t.total_budget || 100) - (t.points_spent || 0)} <span className="text-[7px] opacity-40">VFL</span></p>
                         </div>
                      ))}
                   </div>
                </div>

                <div>
                   <h3 className="text-[10px] font-black uppercase text-primary/60 tracking-[0.3em] mb-4 flex items-center justify-between">
                      <span>Recent Results</span>
                      <Star className="w-3 h-3" />
                   </h3>
                   <div className="space-y-2">
                      {finishedPlayers.filter(p => p.status === 'SOLD').slice(0, 2).map(p => (
                         <div key={p.id} className="p-3 rounded-xl bg-black/40 border border-white/5">
                            <div className="flex justify-between items-center">
                               <div>
                                  <p className="text-[9px] font-headline font-black uppercase italic text-white leading-none mb-1">{p.name}</p>
                                  <p className="text-[7px] font-black uppercase text-primary italic tracking-widest leading-none">{p.teams?.name}</p>
                                </div>
                                <p className="text-xs font-headline font-black italic text-white leading-none tracking-tighter">{p.sold_price}</p>
                            </div>
                         </div>
                      ))}
                      {finishedPlayers.filter(p => p.status === 'SOLD').length === 0 && (
                         <p className="text-[8px] italic text-white/10 text-center uppercase tracking-widest">Awaiting Sold Call</p>
                      )}
                   </div>
                </div>
             </div>
          </div>
        </div>
      </main>

      {/* Outbid/Notification System */}
      {outbidToast && (
        <div className="fixed bottom-24 right-6 z-50 flex flex-col gap-3 max-w-sm w-full pointer-events-auto">
          <motion.div 
            initial={{ x: 100, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            className="bg-[#0f172a] border-l-4 border-error p-5 rounded-xl shadow-2xl flex gap-4 items-start"
          >
            <div className="bg-error/10 p-2 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-error" />
            </div>
            <div className="flex flex-col flex-1">
              <span className="font-label text-sm font-black text-white uppercase tracking-tight">OUTBID ALERT</span>
              <span className="text-xs text-white/40 mt-1">A higher bid has been registered for {activePlayer.name}.</span>
            </div>
            <button onClick={() => setOutbidToast(false)} className="text-white/20 hover:text-white transition-colors">
              <X className="w-5 h-5" />
            </button>
          </motion.div>
        </div>
      )}
      {/* Cinematic Sold/Unsold Overlay */}
      {sellAnimation && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 sm:p-12 overflow-hidden pointer-events-none bg-black/40 backdrop-blur-sm">
          <motion.div 
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 1.1, opacity: 0 }}
            className="relative w-full max-w-lg aspect-square flex flex-col items-center justify-center text-center"
          >
            <div className={cn(
               "absolute inset-0 rounded-full blur-[120px] opacity-40 animate-pulse",
               sellAnimation.type === 'SOLD' ? "bg-emerald-500" : "bg-error"
            )}></div>

            <div className="relative z-10 bg-black/90 backdrop-blur-2xl border-4 border-white/10 p-12 rounded-[3rem] shadow-2xl w-full border-b-primary/40">
               <motion.div 
                 initial={{ y: 20, opacity: 0 }}
                 animate={{ y: 0, opacity: 1 }}
                 transition={{ delay: 0.2 }}
                 className="mb-8"
               >
                 <span className={cn(
                   "px-6 py-2 rounded-full font-headline font-black italic text-xs uppercase tracking-[0.4em] inline-block mb-6 shadow-lg",
                   sellAnimation.type === 'SOLD' ? "bg-emerald-500 text-black" : "bg-error text-white"
                 )}>
                   {sellAnimation.type}
                 </span>
                 <h2 className="text-6xl font-headline font-black italic tracking-tighter uppercase text-white mb-4 leading-none text-glow">
                    {sellAnimation.player.name}
                 </h2>
                 {sellAnimation.type === 'SOLD' && (
                   <p className="text-2xl font-headline font-black text-primary italic uppercase tracking-[0.2em] mt-6 bg-white/5 py-4 rounded-2xl border border-white/5">
                      FINAL CALL: {sellAnimation.player.sold_price} VFL
                   </p>
                 )}
               </motion.div>

               <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ scaleX: 0 }}
                    animate={{ scaleX: 1 }}
                    transition={{ duration: 5 }}
                    className={cn(
                      "h-full origin-left shadow-[0_0_10px_rgba(255,255,255,0.5)]",
                      sellAnimation.type === 'SOLD' ? "bg-emerald-500" : "bg-error"
                    )}
                  />
               </div>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}


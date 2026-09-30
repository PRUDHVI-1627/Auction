import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import {
  Play, Pause, SkipForward, RotateCcw, Megaphone,
  Bell, Wallet, Gavel, Ban, Undo, ChevronRight, SquarePen, Check, X
} from 'lucide-react';
import { cn } from '../lib/utils';
import { supabase } from '../lib/supabase';

interface AdminDashboardProps {
  user: any;
}

export default function AdminDashboard({ user }: AdminDashboardProps) {
  const [session, setSession] = useState<any>(null);
  const [activePlayer, setActivePlayer] = useState<any>(null);
  const [bids, setBids] = useState<any[]>([]);
  const [finishedPlayers, setFinishedPlayers] = useState<any[]>([]);
  const [upcomingPlayers, setUpcomingPlayers] = useState<any[]>([]);
  const [allTeams, setAllTeams] = useState<any[]>([]);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [announcement, setAnnouncement] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [manualAmount, setManualAmount] = useState<string>('');
  const [selectedTeamId, setSelectedTeamId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [editingSaleId, setEditingSaleId] = useState<string | null>(null);
  const [editSaleTeamId, setEditSaleTeamId] = useState<string>('');
  const [editSalePrice, setEditSalePrice] = useState<string>('');
  const unsoldCount = finishedPlayers.filter((player) => player.status === 'UNSOLD').length;

  useEffect(() => {
    initAdmin();

    const sub = supabase
      .channel('admin-view')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'auction_session' }, (payload: any) => {
        setSession(payload.new);
        if (payload.new?.current_player_id) {
          fetchPlayer(payload.new.current_player_id);
          fetchBids(payload.new.current_player_id);
        } else {
          setActivePlayer(null);
          setBids([]);
        }
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'bids' }, (payload: any) => {
        if (activePlayer && payload.new.player_id === activePlayer.id) {
          fetchBids(payload.new.player_id);
        }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'players' }, (payload: any) => {
        if (activePlayer && payload.new.id === activePlayer.id) setActivePlayer(payload.new);
        if (payload.new.status === 'UPCOMING' || payload.new.status === 'SOLD' || payload.new.status === 'UNSOLD') {
          setTimeout(() => {
            fetchUpcoming();
            fetchFinished();
          }, 500);
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(sub); };
  }, [activePlayer?.id]);

  async function getAuthHeaders(): Promise<HeadersInit> {
    const { data: { session } } = await supabase.auth.getSession();
    return {
      'Content-Type': 'application/json',
      ...(session?.access_token ? { 'Authorization': `Bearer ${session.access_token}` } : {}),
    };
  }

  async function initAdmin() {
    const { data: sess } = await supabase.from('auction_session').select('*').single();
    setSession(sess);
    if (sess?.current_player_id) {
       fetchPlayer(sess.current_player_id);
       fetchBids(sess.current_player_id);
    }
    fetchUpcoming();
    fetchFinished();
    fetchAllTeams();
    fetchAllUsers();
    setLoading(false);
  }

  async function fetchAllTeams() {
    const { data } = await supabase.from('teams').select('*').order('name');
    setAllTeams(data || []);
  }

  async function fetchAllUsers() {
    const { data } = await supabase.from('users').select('*').order('created_at', { ascending: false });
    setAllUsers(data || []);
  }

  async function fetchFinished() {
    const { data } = await supabase
      .from('players')
      .select('*, teams(*)')
      .or('status.eq.SOLD,status.eq.UNSOLD')
      .order('updated_at', { ascending: false });
    setFinishedPlayers(data || []);
  }

  async function fetchPlayer(id: string) {
    const { data } = await supabase.from('players').select('*').eq('id', id).single();
    setActivePlayer(data);
  }

  async function fetchBids(playerId: string) {
    const { data } = await supabase
      .from('bids')
      .select('*, teams(name)')
      .eq('player_id', playerId)
      .eq('is_undone', false)
      .order('created_at', { ascending: false });
    setBids(data || []);
  }

  async function fetchUpcoming() {
    const { data } = await supabase.from('players').select('*').eq('status', 'UPCOMING').order('queue_order', { ascending: true });
    setUpcomingPlayers(data || []);
  }

  async function startAuction(playerId?: string) {
    setIsProcessing(true);
    try {
      const response = await fetch('/api/auction/next-player', {
        method: 'POST',
        headers: await getAuthHeaders(),
        body: JSON.stringify(playerId ? { playerId } : {})
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Server returned ${response.status}`);
      }
    } catch (err: any) {
      console.error('Error starting auction:', err);
      alert('Failed to start auction: ' + err.message);
    } finally {
      setIsProcessing(false);
    }
  }

  async function handleSold() {
    const latestBid = bids[0];
    if (!activePlayer || !latestBid) return;
    setIsProcessing(true);

    try {
      const response = await fetch('/api/auction/sell', {
        method: 'POST',
        headers: await getAuthHeaders(),
        body: JSON.stringify({
          playerId: activePlayer.id,
          teamId: latestBid.team_id,
          price: latestBid.amount
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Server returned ${response.status}`);
      }

      setActivePlayer(null);
      setBids([]);
    } catch (err: any) {
      console.error('Error finalizing sale:', err);
      alert('Sale failed: ' + err.message);
    } finally {
      setIsProcessing(false);
    }
  }

  async function handleUnsold() {
    if (!activePlayer) return;
    setIsProcessing(true);
    try {
      const response = await fetch('/api/auction/unsold', {
        method: 'POST',
        headers: await getAuthHeaders(),
        body: JSON.stringify({ playerId: activePlayer.id })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Server returned ${response.status}`);
      }

      setActivePlayer(null);
      setBids([]);
    } catch (err: any) {
      console.error('Error marking unsold:', err);
      alert('Action failed: ' + err.message);
    } finally {
      setIsProcessing(false);
    }
  }

  async function togglePause() {
    if (!session) return;
    try {
      await fetch('/api/admin/pause', {
        method: 'POST',
        headers: await getAuthHeaders(),
      });
    } catch (err) {
      console.error('Error toggling pause:', err);
    }
  }

  async function undoLastBid() {
    if (!activePlayer || bids.length === 0) return;
    try {
      const response = await fetch('/api/admin/undo-bid', {
        method: 'POST',
        headers: await getAuthHeaders(),
        body: JSON.stringify({ playerId: activePlayer.id })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Server returned ${response.status}`);
      }
    } catch (err) {
      console.error('Error undoing bid:', err);
    }
  }

  async function handleStartTimer(durationSeconds = 30) {
    if (!activePlayer) return;
    setIsProcessing(true);
    try {
      const response = await fetch('/api/auction/start-timer', {
        method: 'POST',
        headers: await getAuthHeaders(),
        body: JSON.stringify({ durationSeconds }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Server returned ${response.status}`);
      }
    } catch (err: any) {
      alert('Failed to start timer: ' + err.message);
    } finally {
      setIsProcessing(false);
    }
  }

  async function handleManualOverrideBid() {
    if (!activePlayer || !selectedTeamId || !manualAmount) {
      alert("Select team and enter amount");
      return;
    }
    const amount = parseInt(manualAmount);
    if (isNaN(amount) || amount <= (bids[0]?.amount || 0)) {
       alert("Invalid amount or lower than current high bid");
       return;
    }

    setIsProcessing(true);
    try {
      const response = await fetch('/api/bids', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playerId: activePlayer.id,
          teamId: selectedTeamId,
          amount: amount,
          increment_used: 0,
          userId: user.id,
          isOverride: true
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Server returned ${response.status}`);
      }

      setManualAmount('');
      setSelectedTeamId('');
    } catch (err: any) {
      alert("Failed: " + err.message);
    } finally {
      setIsProcessing(false);
    }
  }

  async function postAnnouncement() {
    if (!announcement) return;
    setIsProcessing(true);
    try {
      const response = await fetch('/api/admin/announce', {
        method: 'POST',
        headers: await getAuthHeaders(),
        body: JSON.stringify({
          message: announcement,
          adminId: user?.id
        })
      });

      if (!response.ok) throw new Error(`Announcement failed with ${response.status}`);

      setAnnouncement('');
    } catch (err: any) {
      console.error('Error posting announcement:', err);
      alert('Broadcast failed: ' + err.message);
    } finally {
      setIsProcessing(false);
    }
  }

  async function updateUserRole(userId: string, role: string, teamId: string | null) {
    try {
      const response = await fetch('/api/admin/update-user-role', {
        method: 'POST',
        headers: await getAuthHeaders(),
        body: JSON.stringify({ userId, role, teamId }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Server returned ${response.status}`);
      }

      fetchAllUsers();
    } catch (err: any) {
      alert('Update failed: ' + err.message);
    }
  }

  function startEditSale(player: any) {
    setEditingSaleId(player.id);
    setEditSaleTeamId(player.sold_to_team_id || '');
    setEditSalePrice(String(player.sold_price ?? ''));
  }

  function cancelEditSale() {
    setEditingSaleId(null);
    setEditSaleTeamId('');
    setEditSalePrice('');
  }

  async function saveEditSale() {
    if (!editingSaleId || !editSaleTeamId || !editSalePrice) {
      alert('Select a team and enter a price');
      return;
    }
    setIsProcessing(true);
    try {
      const response = await fetch('/api/admin/edit-sale', {
        method: 'POST',
        headers: await getAuthHeaders(),
        body: JSON.stringify({
          playerId: editingSaleId,
          teamId: editSaleTeamId,
          price: Number(editSalePrice),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Server returned ${response.status}`);
      }

      cancelEditSale();
      fetchFinished();
      fetchAllTeams();
    } catch (err: any) {
      alert('Edit failed: ' + err.message);
    } finally {
      setIsProcessing(false);
    }
  }

  async function handleResetAuction() {
    if (!window.confirm("This will erase all bids and reset every player and team. Continue?")) {
      return;
    }
    if (!window.confirm("This cannot be undone. Reset the entire auction?")) {
      return;
    }

    setIsProcessing(true);
    try {
      const response = await fetch('/api/admin/reset', {
        method: 'POST',
        headers: await getAuthHeaders(),
      });

      if (!response.ok) throw new Error(`Reset failed with ${response.status}`);

      window.location.reload();
    } catch (err: any) {
      console.error('Error resetting auction:', err);
      alert('Reset failed: ' + err.message);
    } finally {
      setIsProcessing(false);
    }
  }

  if (loading) return (
    <div className="min-h-screen bg-base flex items-center justify-center">
      <div className="w-6 h-6 border-2 border-border-strong border-t-accent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="min-h-screen bg-base text-ink font-sans">
      <header className="bg-base/95 backdrop-blur-sm sticky top-0 z-50 border-b border-border">
        <div className="flex justify-between items-center w-full px-6 py-4 max-w-screen-2xl mx-auto">
          <span className="font-display font-semibold text-sm text-ink-muted">VFL Admin</span>
          <div className="flex items-center gap-2 bg-surface border border-border px-3 py-1.5 rounded-full">
            <div className={cn("w-1.5 h-1.5 rounded-full", session?.status === 'LIVE' ? "bg-success" : "bg-ink-faint")} />
            <span className="text-[10px] font-medium uppercase tracking-wide text-ink-muted">{session?.status || 'Offline'}</span>
          </div>
        </div>
      </header>

      <main className="max-w-screen-2xl mx-auto p-6 lg:p-10 space-y-8">
        <section className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
          <div>
            <h1 className="font-display text-3xl md:text-4xl font-bold tracking-tight text-ink">Auction control</h1>
            <p className="text-ink-muted text-sm mt-1">Run the draft cycle for every franchise.</p>
          </div>
          <div className="flex flex-wrap gap-2.5">
            <button
              onClick={togglePause}
              className={cn(
                "px-5 py-2.5 flex items-center gap-2 transition-colors rounded-lg text-sm font-medium",
                session?.status === 'PAUSED' ? "bg-success text-success-ink" : "bg-surface border border-border text-ink hover:border-border-strong"
              )}
            >
              {session?.status === 'PAUSED' ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
              {session?.status === 'PAUSED' ? 'Resume' : 'Pause'}
            </button>
            <button
              onClick={handleResetAuction}
              disabled={isProcessing}
              className="px-5 py-2.5 bg-danger/10 hover:bg-danger/20 text-danger flex items-center gap-2 transition-colors rounded-lg text-sm font-medium"
            >
              <RotateCcw className={cn("w-4 h-4", isProcessing && "animate-spin")} />
              Reset
            </button>
            {upcomingPlayers.length > 0 && (
              <button
                disabled={isProcessing}
                onClick={() => startAuction(upcomingPlayers[0].id)}
                className="px-5 py-2.5 bg-accent hover:bg-accent-hover disabled:opacity-50 text-accent-ink flex items-center gap-2 transition-colors rounded-lg text-sm font-medium"
              >
                <SkipForward className="w-4 h-4" />
                Call {upcomingPlayers[0].name}
              </button>
            )}
            {upcomingPlayers.length === 0 && unsoldCount > 0 && (
              <button
                disabled={isProcessing}
                onClick={() => startAuction()}
                className="px-5 py-2.5 bg-accent hover:bg-accent-hover disabled:opacity-50 text-accent-ink flex items-center gap-2 transition-colors rounded-lg text-sm font-medium"
              >
                <RotateCcw className="w-4 h-4" />
                Re-auction ({unsoldCount})
              </button>
            )}
          </div>
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Active player */}
          <div className="lg:col-span-4 space-y-6">
            {activePlayer ? (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-surface border border-border rounded-2xl overflow-hidden"
              >
                <div className="p-6 flex items-center gap-4 border-b border-border">
                  <img src={activePlayer.photo_url} className="w-16 h-16 rounded-xl object-cover border border-border" />
                  <div className="flex-1 min-w-0">
                    <h3 className="font-display text-xl font-semibold text-ink truncate">{activePlayer.name}</h3>
                    <div className="flex gap-1.5 mt-1.5">
                      <span className="bg-surface-2 px-2 py-0.5 rounded text-[10px] text-ink-muted">{activePlayer.position}</span>
                      <span className="bg-accent/10 text-accent px-2 py-0.5 rounded text-[10px]">{activePlayer.base_price} VFL</span>
                    </div>
                  </div>
                </div>

                <div className="p-6 border-b border-border">
                  <div className="text-[10px] text-ink-faint uppercase tracking-wide mb-1">Current high bid</div>
                  <div className="tnum text-4xl font-bold text-accent">{bids[0]?.amount || activePlayer.base_price}</div>
                </div>

                <div className="p-4 space-y-2.5">
                  <div className="grid grid-cols-2 gap-2.5">
                    <button
                      onClick={handleSold}
                      disabled={bids.length === 0 || isProcessing}
                      className="bg-success/10 hover:bg-success hover:text-success-ink text-success p-4 rounded-xl transition-colors flex flex-col items-center gap-1.5 disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      <Gavel className="w-5 h-5" />
                      <span className="text-xs font-medium">Confirm sale</span>
                    </button>
                    <button
                      onClick={handleUnsold}
                      disabled={isProcessing}
                      className="bg-danger/10 hover:bg-danger hover:text-danger-ink text-danger p-4 rounded-xl transition-colors flex flex-col items-center gap-1.5 disabled:opacity-30"
                    >
                      <Ban className="w-5 h-5" />
                      <span className="text-xs font-medium">Mark unsold</span>
                    </button>
                  </div>
                  <button
                    onClick={() => handleStartTimer()}
                    disabled={isProcessing}
                    className="w-full bg-surface-2 hover:bg-surface-3 text-ink py-3 rounded-xl transition-colors flex items-center justify-center gap-2 disabled:opacity-30 text-xs font-medium"
                  >
                    <Play className="w-3.5 h-3.5" />
                    Start 30s timer
                  </button>
                </div>
              </motion.div>
            ) : (
              <div className="aspect-[3/4] border border-dashed border-border rounded-2xl flex flex-col items-center justify-center text-center p-10">
                <Gavel className="w-8 h-8 text-ink-faint mb-3" />
                <p className="text-sm text-ink-muted">No player in spotlight</p>
                <p className="text-xs text-ink-faint mt-1">Call a player above to begin</p>
              </div>
            )}
          </div>

          {/* Bid sequence */}
          <div className="lg:col-span-8 flex flex-col gap-6">
            <div className="flex-1 bg-surface rounded-2xl border border-border flex flex-col overflow-hidden max-h-[600px]">
              <div className="p-5 border-b border-border">
                <span className="text-sm font-medium text-ink">Bid sequence</span>
              </div>
              <div className="flex-1 overflow-y-auto p-5 space-y-2.5">
                {bids.map((bid, index) => (
                  <motion.div
                    layout
                    initial={{ x: 12, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    transition={{ layout: { type: 'spring', stiffness: 300, damping: 28 } }}
                    key={bid.id}
                    className={cn(
                      "flex justify-between items-center bg-surface-2 p-4 rounded-xl border-l-2",
                      index === 0 ? "border-accent" : "border-border"
                    )}
                  >
                    <div>
                      <p className={cn("text-[10px] font-medium uppercase tracking-wide mb-1", index === 0 ? "text-accent" : "text-ink-faint")}>
                        {index === 0 ? 'Highest bid' : 'Previous'}
                      </p>
                      <p className="tnum text-2xl font-semibold text-ink">{bid.amount} VFL</p>
                      <p className="text-xs text-ink-muted">{bid.teams?.name || 'Unknown team'}</p>
                    </div>
                    <div className="text-right">
                      <div className={cn("px-2 py-0.5 rounded text-[9px] font-medium uppercase", index === 0 ? "bg-accent/15 text-accent" : "bg-surface-3 text-ink-faint")}>
                        {index === 0 ? 'Leading' : 'Outbid'}
                      </div>
                      <p className="text-[10px] text-ink-faint mt-1.5">{new Date(bid.created_at).toLocaleTimeString()}</p>
                    </div>
                  </motion.div>
                ))}
                {bids.length === 0 && <div className="text-center py-16 text-ink-faint text-sm">Waiting for the opening bid</div>}
              </div>
              <div className="p-5 bg-surface-2 border-t border-border space-y-3">
                {activePlayer && (
                  <div className="p-3.5 bg-surface border border-border rounded-xl space-y-2.5">
                    <p className="text-[10px] font-medium uppercase tracking-wide text-ink-faint">Manual override</p>
                    <div className="flex gap-2">
                      <select
                        value={selectedTeamId}
                        onChange={(e) => setSelectedTeamId(e.target.value)}
                        className="flex-1 bg-surface-2 border border-border rounded-lg px-3 py-2 text-xs text-ink focus:border-accent outline-none transition-colors"
                      >
                        <option value="">Select team</option>
                        {allTeams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                      </select>
                      <input
                        type="number"
                        placeholder="Amount"
                        value={manualAmount}
                        onChange={(e) => setManualAmount(e.target.value)}
                        className="w-24 bg-surface-2 border border-border rounded-lg px-3 py-2 text-xs text-ink placeholder:text-ink-faint outline-none focus:border-accent transition-colors text-center"
                      />
                      <button
                        onClick={handleManualOverrideBid}
                        disabled={isProcessing || !selectedTeamId || !manualAmount}
                        className="bg-accent text-accent-ink font-medium px-4 py-2 rounded-lg text-xs hover:bg-accent-hover disabled:opacity-30 transition-colors"
                      >
                        Bid
                      </button>
                    </div>
                  </div>
                )}

                <button
                  onClick={undoLastBid}
                  disabled={bids.length === 0}
                  className="w-full py-3 flex items-center justify-center gap-2 text-danger bg-danger/5 hover:bg-danger/10 rounded-lg transition-colors disabled:opacity-30 text-xs font-medium"
                >
                  <Undo className="w-4 h-4" />
                  Undo last bid
                </button>
              </div>
            </div>
          </div>

          {/* Auxiliary */}
          <div className="lg:col-span-3 space-y-6">
            <div className="bg-surface p-5 rounded-2xl border border-border space-y-3">
              <div className="flex items-center gap-2">
                <Megaphone className="w-4 h-4 text-accent" />
                <span className="text-xs font-medium text-ink-muted">Broadcast</span>
              </div>
              <textarea
                value={announcement}
                onChange={(e) => setAnnouncement(e.target.value)}
                className="w-full bg-surface-2 border border-border rounded-xl p-3 text-sm text-ink placeholder:text-ink-faint focus:border-accent transition-colors h-20 outline-none resize-none"
                placeholder="Message for all portals"
              />
              <button onClick={postAnnouncement} className="w-full bg-accent hover:bg-accent-hover text-accent-ink font-medium text-sm py-2.5 rounded-lg transition-colors">
                Send
              </button>
            </div>

            <div className="bg-surface p-5 rounded-2xl border border-border max-h-[300px] overflow-y-auto">
              <h4 className="text-xs font-medium text-ink-muted mb-4 flex justify-between">
                <span>Ledger</span>
                <span className="text-ink-faint">{finishedPlayers.length}</span>
              </h4>
              <div className="space-y-3">
                {finishedPlayers.map(p => (
                  <div key={p.id}>
                    {editingSaleId === p.id ? (
                      <div className="bg-surface-2 border border-border rounded-lg p-3 space-y-2">
                        <p className="text-xs font-medium text-ink">{p.name}</p>
                        <div className="flex gap-1.5">
                          <select
                            value={editSaleTeamId}
                            onChange={(e) => setEditSaleTeamId(e.target.value)}
                            className="flex-1 bg-surface border border-border rounded-lg px-2 py-1.5 text-[11px] text-ink focus:border-accent outline-none transition-colors"
                          >
                            <option value="">Team</option>
                            {allTeams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                          </select>
                          <input
                            type="number"
                            value={editSalePrice}
                            onChange={(e) => setEditSalePrice(e.target.value)}
                            className="w-16 bg-surface border border-border rounded-lg px-2 py-1.5 text-[11px] text-ink outline-none focus:border-accent transition-colors text-center"
                          />
                          <button
                            onClick={saveEditSale}
                            disabled={isProcessing}
                            className="p-1.5 bg-success/10 text-success rounded-lg hover:bg-success hover:text-success-ink transition-colors disabled:opacity-40"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={cancelEditSale}
                            className="p-1.5 bg-surface text-ink-faint rounded-lg hover:text-ink transition-colors"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex justify-between items-center group">
                        <div>
                          <span className="block text-sm text-ink">{p.name}</span>
                          <span className={cn("text-[10px] uppercase tracking-wide", p.status === 'SOLD' ? 'text-success' : 'text-danger')}>
                            {p.status === 'SOLD' ? `Sold to ${p.teams?.name || (p as any).teams?.[0]?.name || 'team'}` : 'Unsold'}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="tnum text-sm text-ink-muted">{p.sold_price || '—'}</span>
                          {p.status === 'SOLD' && (
                            <button
                              onClick={() => startEditSale(p)}
                              className="p-1 text-ink-faint hover:text-accent opacity-0 group-hover:opacity-100 transition-opacity"
                              title="Correct this sale"
                            >
                              <SquarePen className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
                {finishedPlayers.length === 0 && <p className="text-xs text-ink-faint text-center py-4">Nothing settled yet</p>}
              </div>
            </div>

            <div className="bg-surface p-5 rounded-2xl border border-border">
              <h4 className="text-xs font-medium text-ink-muted mb-4">Upcoming bench</h4>
              <div className="space-y-2.5">
                {upcomingPlayers.slice(0, 5).map(p => (
                  <div key={p.id} className="flex justify-between items-center" title={p.position}>
                    <span className="text-sm text-ink truncate">{p.name}</span>
                    <span className="text-[10px] text-ink-faint uppercase">{p.tier}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Access control */}
          <div className="lg:col-span-12">
            <div className="bg-surface border border-border rounded-2xl overflow-hidden">
              <div className="p-6 border-b border-border flex justify-between items-center">
                <div>
                  <h3 className="font-display text-xl font-semibold text-ink">Access control</h3>
                  <p className="text-xs text-ink-faint mt-0.5">Assign captains and admins</p>
                </div>
                <button onClick={fetchAllUsers} className="p-2 hover:bg-surface-2 rounded-lg transition-colors">
                  <RotateCcw className="w-4 h-4 text-ink-faint" />
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="text-[10px] font-medium uppercase tracking-wide text-ink-faint border-b border-border">
                      <th className="px-6 py-3">Identity</th>
                      <th className="px-6 py-3">Role</th>
                      <th className="px-6 py-3">Team</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {allUsers.map(u => (
                      <tr key={u.id} className="hover:bg-surface-2/50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-surface-2 flex items-center justify-center text-xs font-medium text-ink-muted overflow-hidden">
                              {u.avatar_url ? <img src={u.avatar_url} className="w-full h-full object-cover" /> : u.email[0].toUpperCase()}
                            </div>
                            <div>
                              <div className="text-sm text-ink">{u.name || 'Anonymous'}</div>
                              <div className="text-[11px] text-ink-faint">{u.email}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <select
                            value={u.role}
                            onChange={(e) => updateUserRole(u.id, e.target.value, u.team_id)}
                            className="bg-surface-2 border border-border rounded-lg px-3 py-1.5 text-xs text-ink focus:border-accent outline-none transition-colors"
                          >
                            <option value="VIEWER">Viewer</option>
                            <option value="TEAM_OWNER">Captain</option>
                            <option value="ADMIN">Admin</option>
                          </select>
                        </td>
                        <td className="px-6 py-4">
                          <select
                            value={u.team_id || ''}
                            disabled={u.role !== 'TEAM_OWNER'}
                            onChange={(e) => updateUserRole(u.id, u.role, e.target.value || null)}
                            className="bg-surface-2 border border-border rounded-lg px-3 py-1.5 text-xs text-ink focus:border-accent outline-none transition-colors disabled:opacity-30"
                          >
                            <option value="">No team</option>
                            {allTeams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

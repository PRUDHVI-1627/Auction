import { getAuctionSessionRecord, updateAuctionSessionRecord, supabaseAdmin } from './supabaseAdmin.js';

export async function placeBid({ playerId, teamId, amount, increment_used, userId, isOverride = false }: {
  playerId: string;
  teamId: string;
  amount: number;
  increment_used: number;
  userId: string;
  isOverride?: boolean;
}) {
  const { data: team, error: teamErr } = await supabaseAdmin
    .from('teams')
    .select('total_budget, points_spent')
    .eq('id', teamId)
    .single();
  
  if (teamErr || !team) throw new Error('Team not found');
  const pointsRemaining = team.total_budget - team.points_spent;
  
  if (!isOverride && pointsRemaining < amount) throw new Error('Insufficient points in budget');

  const session = await getAuctionSessionRecord();

  if (session.status !== 'LIVE' || session.current_player_id !== playerId) {
    throw new Error('This player is not currently available for bidding');
  }

  const { data: player, error: playerErr } = await supabaseAdmin
    .from('players')
    .select('id, status, base_price')
    .eq('id', playerId)
    .single();

  if (playerErr || !player) throw new Error('Player records could not be fetched');
  if (player.status !== 'LIVE') throw new Error('This player is not open for bidding');

  const { data: leadingBid, error: leadingBidErr } = await supabaseAdmin
    .from('bids')
    .select('amount, team_id')
    .eq('player_id', playerId)
    .eq('is_undone', false)
    .order('amount', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (leadingBidErr) {
    throw new Error(leadingBidErr.message);
  }
  
  if (!isOverride && leadingBid?.team_id === teamId) {
    throw new Error('You are already the leading bidder');
  }

  if (!leadingBid && amount < player.base_price) {
    throw new Error(`Bid must be equal to or greater than ${player.base_price}`);
  }

  if (leadingBid && amount <= leadingBid.amount) {
    throw new Error(`Bid must be greater than ${leadingBid.amount}`);
  }

  const { error: insertErr } = await supabaseAdmin
    .from('bids')
    .insert([{ player_id: playerId, team_id: teamId, amount, increment_used }]);

  if (insertErr) throw new Error(insertErr.message || 'Failed to record bid');

  return { success: true, new_amount: amount, teamId };
}

export async function finalizeSale(playerId: string, teamId: string, price: number) {
  const { data: existingPlayer, error: existingErr } = await supabaseAdmin
    .from('players')
    .select('status')
    .eq('id', playerId)
    .single();

  if (existingErr) throw new Error(existingErr.message);
  if (existingPlayer?.status === 'SOLD') throw new Error('Player has already been sold');

  const { data: team, error: teamErr } = await supabaseAdmin
    .from('teams')
    .select('points_spent')
    .eq('id', teamId)
    .single();

  if (teamErr || !team) {
    throw new Error(teamErr?.message || 'Team not found');
  }

  const newPointsSpent = (team.points_spent || 0) + price;

  const { error: teamUpdateErr } = await supabaseAdmin
    .from('teams')
    .update({ 
      points_spent: newPointsSpent,
      updated_at: new Date().toISOString()
    })
    .eq('id', teamId);

  if (teamUpdateErr) {
    throw new Error(teamUpdateErr.message);
  }

  const { error: playerUpdateErr } = await supabaseAdmin
    .from('players')
    .update({ 
      status: 'SOLD', 
      sold_to_team_id: teamId, 
      sold_price: price,
      updated_at: new Date().toISOString()
    })
    .eq('id', playerId);

  if (playerUpdateErr) {
    throw new Error(playerUpdateErr.message);
  }
  
  await updateAuctionSessionRecord({ current_player_id: null, timer_expires_at: null });
}

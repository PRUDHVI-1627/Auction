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
  const pointsRemaining = (team.total_budget ?? 0) - (team.points_spent ?? 0);

  if (!isOverride && pointsRemaining < amount) throw new Error('Insufficient points in budget');

  const session = await getAuctionSessionRecord();

  if (session.status !== 'LIVE' || session.current_player_id !== playerId) {
    throw new Error('This player is not currently available for bidding');
  }

  if (!isOverride && session.timer_expires_at && new Date(session.timer_expires_at).getTime() < Date.now()) {
    throw new Error('Bidding has closed for this player');
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

  const { data: inserted, error: insertErr } = await supabaseAdmin
    .from('bids')
    .insert([{ player_id: playerId, team_id: teamId, amount, increment_used, is_admin_override: isOverride }])
    .select('id, created_at')
    .single();

  if (insertErr || !inserted) throw new Error(insertErr?.message || 'Failed to record bid');

  // Check-then-insert is not atomic: if two bids race, re-read the active bids and
  // withdraw ours if another bid at the same or a higher amount landed first.
  if (!isOverride) {
    const { data: rivals } = await supabaseAdmin
      .from('bids')
      .select('id, amount, created_at')
      .eq('player_id', playerId)
      .eq('is_undone', false)
      .neq('id', inserted.id)
      .gte('amount', amount);

    const lostRace = (rivals ?? []).some(r =>
      r.amount > amount || new Date(r.created_at).getTime() <= new Date(inserted.created_at).getTime()
    );
    if (lostRace) {
      await supabaseAdmin.from('bids').update({ is_undone: true }).eq('id', inserted.id);
      throw new Error('Another bid was placed at the same time. Please try again.');
    }
  }

  return { success: true, new_amount: amount, teamId };
}

export async function finalizeSale(playerId: string, teamId: string, price: number) {
  if (!playerId || !teamId) throw new Error('playerId and teamId are required');
  if (!Number.isInteger(price) || price < 0) throw new Error('Invalid price');

  const { data: existingPlayer, error: existingErr } = await supabaseAdmin
    .from('players')
    .select('status')
    .eq('id', playerId)
    .single();

  if (existingErr) throw new Error(existingErr.message);
  if (existingPlayer?.status === 'SOLD') throw new Error('Player has already been sold');

  const { data: team, error: teamErr } = await supabaseAdmin
    .from('teams')
    .select('points_spent, total_budget')
    .eq('id', teamId)
    .single();

  if (teamErr || !team) {
    throw new Error(teamErr?.message || 'Team not found');
  }

  if ((team.points_spent || 0) + price > (team.total_budget ?? 0)) {
    throw new Error('Team does not have enough budget for this sale');
  }

  // Claim the player first, guarded on status, so a double-click or concurrent
  // request cannot charge the team twice.
  const { data: claimed, error: playerUpdateErr } = await supabaseAdmin
    .from('players')
    .update({
      status: 'SOLD',
      sold_to_team_id: teamId,
      sold_price: price,
      updated_at: new Date().toISOString()
    })
    .eq('id', playerId)
    .neq('status', 'SOLD')
    .select('id');

  if (playerUpdateErr) throw new Error(playerUpdateErr.message);
  if (!claimed || claimed.length === 0) throw new Error('Player has already been sold');

  const { error: teamUpdateErr } = await supabaseAdmin
    .from('teams')
    .update({
      points_spent: (team.points_spent || 0) + price,
      updated_at: new Date().toISOString()
    })
    .eq('id', teamId);

  if (teamUpdateErr) {
    // roll the player back so the books stay consistent
    await supabaseAdmin
      .from('players')
      .update({ status: 'LIVE', sold_to_team_id: null, sold_price: null })
      .eq('id', playerId);
    throw new Error(teamUpdateErr.message);
  }

  await updateAuctionSessionRecord({ current_player_id: null, timer_expires_at: null });
}

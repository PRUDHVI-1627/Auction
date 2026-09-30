import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  User, Shield, Wallet, Trophy, Settings, 
  HelpCircle, LogOut, ChevronRight, Bell,
  Target, Award, History
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { cn } from '../lib/utils';

interface UserProfileProps {
  user: any;
  onLogout?: () => void;
}

export default function UserProfile({ user, onLogout }: UserProfileProps) {
  const [userData, setUserData] = useState<any>(user);
  const [loading, setLoading] = useState(true);
  const [teamData, setTeamData] = useState<any>(null);
  const [rosterSize, setRosterSize] = useState(0);
  const [teamRank, setTeamRank] = useState<number | null>(null);

  useEffect(() => {
    fetchProfile();
  }, []);

  async function fetchProfile() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profile } = await supabase
      .from('users')
      .select('*, teams(*)')
      .eq('id', user.id)
      .single();

    setUserData(profile);
    if (profile?.teams) {
      setTeamData(profile.teams);

      // Fetch roster count for this team
      const { count } = await supabase
        .from('players')
        .select('*', { count: 'exact', head: true })
        .eq('sold_to_team_id', profile.teams.id);
      setRosterSize(count || 0);

      // Compute rank: teams ordered by points_spent descending
      const { data: allTeams } = await supabase
        .from('teams')
        .select('id, points_spent')
        .order('points_spent', { ascending: false });
      const rank = allTeams?.findIndex(t => t.id === profile.teams.id) ?? -1;
      setTeamRank(rank !== -1 ? rank + 1 : null);
    }
    setLoading(false);
  }

  const handleLogout = async () => {
    await supabase.auth.signOut();
    if (onLogout) onLogout();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center text-primary font-black animate-pulse uppercase tracking-[1em]">
        ACCESSING VAULT...
      </div>
    );
  }

  const budgetRemaining = teamData ? (teamData.total_budget - teamData.points_spent) : 0;
  const budgetProgress = teamData ? (teamData.points_spent / teamData.total_budget) * 100 : 0;

  return (
    <div className="min-h-screen bg-surface text-on-surface font-body overflow-x-hidden selection:bg-primary selection:text-surface pt-20 pb-32">
      {/* Background visual accents */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/5 blur-[120px] rounded-full"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-tertiary/5 blur-[120px] rounded-full"></div>
      </div>

      <main className="relative z-10 max-w-lg mx-auto px-6 space-y-8">
        {/* User Hero Section */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center text-center space-y-4"
        >
          <div className="relative group">
            <div className="absolute inset-0 bg-primary/20 blur-xl group-hover:bg-primary/30 transition-all rounded-full scale-110"></div>
            <div className="relative w-32 h-32 rounded-full border-2 border-primary p-1 bg-surface-container shadow-2xl overflow-hidden active:scale-95 transition-transform">
              {userData?.avatar_url ? (
                <img src={userData.avatar_url} alt="Profile" className="w-full h-full object-cover rounded-full" />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-white/5">
                  <User className="w-12 h-12 text-primary/40" />
                </div>
              )}
            </div>
            <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 px-3 py-1 bg-primary text-surface font-label font-black text-[10px] uppercase tracking-widest rounded-full shadow-lg">
              {userData?.role || 'VIEWER'}
            </div>
          </div>

          <div className="space-y-1">
            <h1 className="font-headline font-black italic tracking-tighter text-4xl uppercase text-white shadow-glow">
              {userData?.name || user?.user_metadata?.full_name || 'VFL ATHLETE'}
            </h1>
            <p className="font-label text-xs text-on-surface/40 uppercase tracking-[0.3em] font-bold">
              {user?.email}
            </p>
          </div>
        </motion.div>

        {/* Team Status Card (Only for Team Owners) */}
        {userData?.role === 'TEAM_OWNER' && teamData && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 }}
            className="bg-surface-container-highest/40 backdrop-blur-2xl border border-white/5 rounded-2xl overflow-hidden"
          >
            <div className="p-6 space-y-6">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <Trophy className="w-5 h-5 text-primary" />
                  </div>
                  <span className="font-headline font-black italic uppercase text-lg text-white">TEAM {teamData.name}</span>
                </div>
                <div className="text-right">
                  <span className="block text-[10px] font-label font-bold text-on-surface/40 uppercase tracking-widest">RANK</span>
                  <span className="font-headline font-black italic text-primary">#{teamRank ?? '—'}</span>
                </div>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between items-end">
                    <span className="text-[10px] font-label font-bold text-on-surface/60 uppercase tracking-widest flex items-center gap-1">
                      <Wallet className="w-3 h-3 text-primary" /> Budget Utilization
                    </span>
                    <span className="font-label font-black text-sm text-white">
                      {teamData.points_spent} / {teamData.total_budget} <span className="text-primary/60">VFL</span>
                    </span>
                  </div>
                  <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${budgetProgress}%` }}
                      className="h-full bg-gradient-to-r from-primary to-primary-dim rounded-full shadow-[0_0_10px_rgba(255,231,146,0.5)]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-white/5 p-4 rounded-xl border border-white/5 hover:border-white/10 transition-colors">
                    <span className="block text-[10px] font-label font-bold text-on-surface/40 uppercase tracking-widest mb-1">Roster Size</span>
                    <span className="font-headline text-2xl font-black italic text-white">{String(rosterSize).padStart(2, '0')} <span className="text-xs opacity-20">/ 11</span></span>
                  </div>
                  <div className="bg-white/5 p-4 rounded-xl border border-white/5 hover:border-white/10 transition-colors">
                    <span className="block text-[10px] font-label font-bold text-on-surface/40 uppercase tracking-widest mb-1">Available VFL</span>
                    <span className="font-headline text-2xl font-black italic text-primary">{budgetRemaining}</span>
                  </div>
                </div>
              </div>
            </div>
            
            <button disabled title="Coming soon" className="w-full py-4 bg-white/5 text-[10px] font-label font-black uppercase tracking-[0.2em] text-primary/40 flex items-center justify-center gap-2 border-t border-white/5 cursor-not-allowed">
              VIEW FULL ROSTER <ChevronRight className="w-4 h-4" />
            </button>
          </motion.div>
        )}

        {/* Action List */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="space-y-3"
        >
          <p className="px-1 text-[10px] font-label font-bold text-on-surface/30 uppercase tracking-[0.4em] mb-4">Command Center</p>
          
          {[
            { id: 'edit', label: 'Edit Profile', sub: 'Change name and avatar', icon: Settings, color: 'text-white' },
            { id: 'notifications', label: 'Notifications', sub: 'Manage bid alerts', icon: Bell, color: 'text-tertiary' },
            { id: 'history', label: 'Bid History', sub: 'Your past activity', icon: History, color: 'text-primary' },
            { id: 'support', label: 'Support & Help', sub: 'FAQ and troubleshooting', icon: HelpCircle, color: 'text-white/40' },
          ].map((item) => (
            <button
              key={item.id}
              disabled
              title="Coming soon"
              className="w-full flex items-center justify-between p-4 bg-surface-container/60 border border-white/5 rounded-xl opacity-40 cursor-not-allowed group"
            >
              <div className="flex items-center gap-4">
                <div className={cn("p-2 rounded-lg bg-surface-container-highest group-hover:scale-110 transition-transform", item.color)}>
                  <item.icon className="w-5 h-5" />
                </div>
                <div className="text-left">
                  <span className="block font-headline font-bold uppercase text-sm text-white tracking-tight">{item.label}</span>
                  <span className="block text-[10px] font-label text-on-surface/40 uppercase tracking-wide">{item.sub}</span>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-on-surface/20 group-hover:text-primary group-hover:translate-x-1 transition-all" />
            </button>
          ))}

          <button 
            onClick={handleLogout}
            className="w-full flex items-center justify-between p-4 mt-8 bg-error/5 hover:bg-error/10 border border-error/10 rounded-xl transition-all group active:scale-[0.98]"
          >
            <div className="flex items-center gap-4">
              <div className="p-2 rounded-lg bg-error/10 text-error group-hover:scale-110 transition-transform">
                <LogOut className="w-5 h-5" />
              </div>
              <div className="text-left">
                <span className="block font-headline font-bold uppercase text-sm text-error tracking-tight">Security Log Out</span>
                <span className="block text-[10px] font-label text-error/40 uppercase tracking-wide">End current portal session</span>
              </div>
            </div>
            <div className="px-2 py-1 bg-error/10 rounded font-label text-[9px] font-black text-error uppercase tracking-thinnest">Secure</div>
          </button>
        </motion.div>

        {/* Decorative Footer */}
        <div className="pt-8 text-center space-y-4 opacity-20 hover:opacity-100 transition-opacity">
          <div className="flex justify-center gap-8">
            <Shield className="w-6 h-6 text-white" />
            <Award className="w-6 h-6 text-primary" />
            <Target className="w-6 h-6 text-tertiary" />
          </div>
          <p className="text-[9px] font-label font-black uppercase tracking-[0.5em]">VFL SECURE ACCESS PROTOCOL 5.0</p>
        </div>
      </main>
    </div>
  );
}

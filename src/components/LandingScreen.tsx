import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from '../lib/supabase';
import { Mail, Lock, LogIn, Github, Chrome, Loader2, AlertCircle, UserPlus } from 'lucide-react';
import { cn } from '../lib/utils';

interface LandingScreenProps {
  onLogin: (mockUser?: any) => void;
}

export default function LandingScreen({ onLogin }: LandingScreenProps) {
  const [authMode, setAuthMode] = useState<'google' | 'email'>('google');
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resetSent, setResetSent] = useState(false);
  const [confirmSent, setConfirmSent] = useState(false);
  const [stats, setStats] = useState({ teams: 0, players: 0, pool: 0 });
  const [recentSales, setRecentSales] = useState<any[]>([]);

  React.useEffect(() => {
    async function fetchStats() {
      try {
        const { count: teamCount } = await supabase.from('teams').select('*', { count: 'exact', head: true });
        const { count: playerCount } = await supabase.from('players').select('*', { count: 'exact', head: true });
        const { data: teamsData } = await supabase.from('teams').select('total_budget');
        
        const totalPool = teamsData?.reduce((acc, t) => acc + (t.total_budget || 0), 0) || 0;
        
        if (teamCount !== null && playerCount !== null) {
          setStats({
            teams: teamCount,
            players: playerCount,
            pool: totalPool || (teamCount * 100) // Fallback if budget is 0
          });
        }
      } catch (err) {
        console.error("Failed to fetch landing stats", err);
      }
    }
    fetchStats();
    async function fetchRecentSales() {
      try {
        const { data } = await supabase
          .from('players')
          .select('name, sold_price, sold_to:teams(name)')
          .eq('status', 'SOLD')
          .order('updated_at', { ascending: false })
          .limit(5);
        if (data && data.length > 0) setRecentSales(data);
      } catch (err) {
        console.error('Failed to fetch recent sales', err);
      }
    }
    fetchRecentSales();
  }, []);

  const handleGoogleLogin = async () => {
    setLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    });
    if (error) setError(error.message);
    setLoading(false);
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name: email.split('@')[0] } }
        });
        if (error) throw error;
        setConfirmSent(true);
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        onLogin();
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!email) {
      setError("Please enter your email to receive a reset link.");
      return;
    }
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) setError(error.message);
    else setResetSent(true);
    setLoading(false);
  };
  return (
    <div className="bg-surface text-on-surface font-body overflow-x-hidden selection:bg-primary selection:text-surface min-h-screen">
      {/* Top Ticker Bar */}
      <div className="w-full bg-surface-container-lowest border-b border-outline-variant/20 py-2 overflow-hidden sticky top-0 z-[60]">
        <div className="ticker-scroll flex items-center gap-12">
          {recentSales.length > 0 ? (
            [...recentSales, ...recentSales].map((sale, i) => (
              <div key={i} className="flex items-center gap-2 whitespace-nowrap">
                <span className="font-label text-xs text-on-surface/40 uppercase tracking-widest underline decoration-tertiary">SOLD:</span>
                <span className="font-label text-sm text-on-surface/80">
                  <span className="font-bold">{sale.name}</span> TO <span className="font-bold">{(sale as any).sold_to?.name || 'FRANCHISE'}</span> AT <span className="text-primary">{sale.sold_price} VFL</span>
                </span>
              </div>
            ))
          ) : (
            <>
              {[1, 2].map(i => (
                <div key={i} className="flex items-center gap-2 whitespace-nowrap">
                  <span className="w-2 h-2 rounded-full bg-primary/20 animate-pulse"></span>
                  <span className="font-label text-sm text-on-surface/30 uppercase tracking-widest italic">VFL DRAFT SEASON COMING SOON</span>
                </div>
              ))}
            </>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <main className="relative min-h-screen flex flex-col items-center justify-center px-6 lg:px-12 py-20 bg-mesh">
        {/* Hero Background Visual */}
        <div className="absolute inset-0 z-0 opacity-40 overflow-hidden pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full max-w-7xl">
            <img 
              alt="Cinematic stadium lighting" 
              className="w-full h-full object-cover mix-blend-overlay" 
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuCKy-OehvOtFxtt95EwPxxzLmidkfPGtqZKOyhtnloiMtKjqrMna9bvSguaL7xslvXsjReGf-R6cYAhNueEPKMYXoEamNReAZ8HM_SnG0mYWHtlopDfMBq5rrruV2XUMPvXtBMP0yqvdNRWTKTeOgZdowMTsY49PeRSXKRaZL7BsGSqCuOQPNBWWW0EzJHZuKEUQ5_G6ScU_PAF5AW5W7acdHaESXA4HV8giXa8IAHMkcbCNZHfXCZJZC0akiLcrmbgdq4ykjsFwGQ"
              referrerPolicy="no-referrer"
            />
          </div>
          <div className="absolute inset-0 bg-gradient-to-t from-surface via-transparent to-surface-container-lowest"></div>
        </div>

        {/* Hero Content */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="relative z-10 w-full max-w-5xl text-center flex flex-col items-center"
        >
          <div className="mb-4 inline-flex items-center px-3 py-1 bg-primary/10 border border-primary/20 rounded-full text-primary font-label text-[10px] tracking-[0.2em] uppercase">
            Digital Arena Now Active
          </div>
          <h1 className="font-headline font-black italic tracking-tighter text-6xl md:text-8xl lg:text-[9rem] text-white mb-2 leading-none uppercase drop-shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
            VEDAM <span className="text-primary text-glow block md:inline">FOOTBALL</span> LEAGUE
          </h1>
          <h2 className="font-label font-black text-[10px] md:text-sm tracking-[1em] text-white/40 uppercase mb-16 backdrop-blur-sm bg-black/10 px-6 py-2 rounded-full border border-white/5">
            PLATINUM AUCTION PORTAL
          </h2>

          {/* Authentication Card */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3, duration: 0.7 }}
            className="w-full max-w-4xl bg-black/40 backdrop-blur-3xl p-10 lg:p-14 rounded-[2.5rem] border border-white/10 shadow-[0_50px_100px_rgba(0,0,0,0.6)] relative overflow-hidden"
          >
            {/* Visual Flare */}
            <div className="absolute top-0 left-1/4 w-1/2 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent"></div>
            
            <p className="text-white/40 font-label text-[10px] uppercase tracking-[0.4em] mb-12 max-w-md mx-auto leading-relaxed">
              AUTHORIZATION REQUIRED • SECURE DRAFT ACCESS • PORTAL V2.0
            </p>

            {confirmSent ? (
              <div className="text-center py-8 space-y-4">
                <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto">
                  <Mail className="w-8 h-8 text-emerald-500" />
                </div>
                <h3 className="font-headline font-black italic uppercase text-2xl text-white">Check Your Email</h3>
                <p className="text-white/40 font-label text-xs uppercase tracking-widest max-w-xs mx-auto leading-relaxed">
                  A confirmation link has been sent to <span className="text-primary">{email}</span>. Click it to activate your account.
                </p>
              </div>
            ) : (
            <div className="flex flex-col items-center justify-center space-y-10">
              <button
                onClick={handleGoogleLogin}
                disabled={loading}
                className="w-full max-w-sm px-8 py-6 bg-gradient-to-br from-primary via-gold to-primary-container text-surface rounded-2xl transition-all shadow-[0_20px_40px_rgba(212,175,55,0.2)] hover:shadow-[0_30px_60px_rgba(212,175,55,0.4)] hover:-translate-y-1 active:scale-95 group flex items-center justify-center gap-6 disabled:opacity-50 border border-white/20"
              >
                {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : <Chrome className="w-8 h-8 group-hover:rotate-12 transition-transform" />}
                <div className="text-left flex flex-col">
                  <span className="font-headline font-black text-2xl uppercase leading-none tracking-tighter italic">Enter Arena</span>
                  <span className="font-label font-bold text-[9px] tracking-[0.2em] opacity-60 uppercase mt-1">Single Sign-On Secure</span>
                </div>
              </button>

              <div className="flex items-center gap-3 text-[9px] text-white/20 uppercase tracking-[0.3em] font-label font-black">
                 <div className="flex gap-1">
                   {[1,2,3].map(i => <span key={i} className="w-1 h-1 bg-emerald-500 rounded-full animate-pulse" style={{ animationDelay: `${i*150}ms` }}></span>)}
                 </div>
                 Realtime Sync Active
              </div>
            </div>
            )}

            <div className="mt-12 pt-8 border-t border-white/5 flex flex-col md:flex-row items-center justify-between text-[10px] font-label text-on-surface/40 uppercase tracking-widest gap-4">
              <span>VFL 2026 SEASON • VEDAM FOOTBALL LEAGUE v1.5</span>
              <div className="flex gap-6">
                <a className="hover:text-primary transition-colors flex items-center gap-1" href="#"><span className="material-symbols-outlined text-sm">shield</span> Privacy</a>
                <a className="hover:text-primary transition-colors flex items-center gap-1" href="#"><span className="material-symbols-outlined text-sm">help</span> Support</a>
              </div>
            </div>
          </motion.div>
        </motion.div>

        {/* Floating Stats/Atmosphere Elements */}
        <div className="hidden lg:block absolute bottom-12 left-12 max-w-xs p-6 border-l-2 border-primary/30 bg-surface-container/20 backdrop-blur-md">
          <h4 className="font-label text-xs text-primary mb-2 uppercase tracking-tighter">Current Pool Value</h4>
          <div className="font-headline text-4xl font-black text-white italic">{stats.pool.toLocaleString()}<span className="text-sm not-italic ml-1 text-on-surface/40">VFL</span></div>
          <p className="mt-4 text-xs text-on-surface/50 leading-relaxed font-body">Aggregated team budgets across {stats.teams} participating franchises for the upcoming season draft.</p>
        </div>
        <div className="hidden lg:block absolute bottom-12 right-12 max-w-xs text-right p-6 border-r-2 border-tertiary/30 bg-surface-container/20 backdrop-blur-md">
          <h4 className="font-label text-xs text-tertiary mb-2 uppercase tracking-tighter">Active Registrations</h4>
          <div className="font-headline text-4xl font-black text-white italic">{stats.players}<span className="text-sm not-italic ml-1 text-on-surface/40">PLAYERS</span></div>
          <p className="mt-4 text-xs text-on-surface/50 leading-relaxed font-body">Verified athletes cleared for the professional bidding segment starting tomorrow.</p>
        </div>
      </main>

      {/* Visual Accents: Scanner/Grid Overlay */}
      <div className="fixed inset-0 pointer-events-none z-50">
        <div className="w-full h-full opacity-[0.03] bg-[linear-gradient(rgba(255,255,255,0.1)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.1)_1px,transparent_1px)] bg-[size:40px_40px]"></div>
        <div className="absolute top-0 w-full h-32 bg-gradient-to-b from-surface-container-lowest to-transparent opacity-60"></div>
        <div className="absolute bottom-0 w-full h-32 bg-gradient-to-t from-surface-container-lowest to-transparent opacity-60"></div>
      </div>
    </div>
  );
}

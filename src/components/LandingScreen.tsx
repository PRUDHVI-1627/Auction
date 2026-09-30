import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from '../lib/supabase';
import { Mail, Lock, ArrowRight, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { cn } from '../lib/utils';

interface LandingScreenProps {
  onLogin: (mockUser?: any) => void;
}

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.09, delayChildren: 0.15 } },
};
const rise = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] } },
};

export default function LandingScreen({ onLogin }: LandingScreenProps) {
  const [authMode, setAuthMode] = useState<'google' | 'email'>('google');
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
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
          setStats({ teams: teamCount, players: playerCount, pool: totalPool || (teamCount * 100) });
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
    setError(null);
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
          email, password,
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
    if (!email) { setError("Enter your email first, then request a reset link."); return; }
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
    <div className="min-h-[100dvh] bg-base text-ink relative overflow-hidden flex flex-col">
      {/* === Background layers === */}
      <div className="absolute inset-0 pointer-events-none">
        <div
          className="absolute -right-10 top-0 w-[55%] h-full bg-accent/[0.03]"
          style={{ clipPath: 'polygon(25% 0, 100% 0, 100% 100%, 5% 100%)' }}
        />
        <div className="absolute top-1/2 right-[15%] -translate-y-1/2 w-[600px] h-[600px] rounded-full border border-white/[0.025] hidden lg:block" />
        <div className="absolute top-1/2 right-[15%] -translate-y-1/2 w-[250px] h-[250px] rounded-full border border-white/[0.04] hidden lg:block" />
        <div className="absolute inset-0 pattern-diagonal" />
      </div>

      {/* === Header === */}
      <header className="relative z-10 flex items-center justify-between px-5 sm:px-10 py-5">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full border-2 border-accent flex items-center justify-center flex-shrink-0">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="var(--color-accent)">
              <path d="M12 2L14.09 8.26L20.5 9.27L15.75 13.97L17.18 20.5L12 17.27L6.82 20.5L8.25 13.97L3.5 9.27L9.91 8.26L12 2Z" />
            </svg>
          </div>
          <span className="font-hype text-xl uppercase tracking-wider">VFL</span>
        </div>

        <div className="hidden sm:flex items-center gap-3">
          {[
            { v: stats.teams, l: 'teams' },
            { v: stats.players, l: 'players' },
          ].map(s => (
            <div key={s.l} className="flex items-center gap-1.5 bg-surface/60 backdrop-blur-sm px-3 py-1.5 rounded-full border border-border text-xs">
              <span className="tnum font-semibold text-ink">{s.v}</span>
              <span className="text-ink-faint uppercase tracking-wide text-[10px]">{s.l}</span>
            </div>
          ))}
          <div className="flex items-center gap-1.5 bg-accent/10 px-3 py-1.5 rounded-full border border-accent/20 text-xs">
            <span className="tnum font-semibold text-accent">{stats.pool.toLocaleString()}</span>
            <span className="text-accent/50 uppercase tracking-wide text-[10px]">VFL pool</span>
          </div>
        </div>
      </header>

      {/* === Main: asymmetric hero === */}
      <main className="relative z-10 flex-1 flex flex-col lg:flex-row items-center lg:items-stretch px-5 sm:px-10 py-6 lg:py-0 gap-10 lg:gap-0">
        {/* Left column: hero text */}
        <motion.div
          variants={stagger}
          initial="hidden"
          animate="show"
          className="flex-1 flex flex-col justify-center max-w-2xl lg:pr-16"
        >
          <motion.div variants={rise}>
            <div className="inline-flex items-center gap-2 bg-accent/10 border border-accent/20 px-3.5 py-1.5 rounded-full mb-8">
              <span className="w-1.5 h-1.5 rounded-full bg-accent live-dot" />
              <span className="text-[11px] font-semibold uppercase tracking-widest text-accent">Vedam Football League</span>
            </div>
          </motion.div>

          <motion.h1
            variants={rise}
            className="font-hype text-[clamp(4rem,12vw,9rem)] leading-[0.82] tracking-tight uppercase mb-6"
          >
            <span className="text-ink block">Draft</span>
            <span className="text-accent block">Night.</span>
          </motion.h1>

          <motion.p variants={rise} className="text-ink-muted text-lg leading-relaxed max-w-md mb-8">
            Bid live for players, track budgets in real time, and watch every sale as it drops.
          </motion.p>

          <motion.div variants={rise} className="flex items-center gap-8 sm:hidden mb-6">
            <StatPill value={stats.teams} label="Teams" />
            <StatPill value={stats.players} label="Players" />
            <StatPill value={stats.pool} label="Pool" accent />
          </motion.div>
        </motion.div>

        {/* Right column: auth card */}
        <div className="w-full lg:w-[400px] lg:flex lg:items-center flex-shrink-0">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            className="w-full bg-surface border border-border rounded-xl overflow-hidden"
          >
            <div className="h-1 bg-accent" />
            <div className="p-6">
              <h2 className="font-display font-semibold text-lg text-ink mb-1">Enter the draft</h2>
              <p className="text-ink-faint text-xs mb-5">Sign in to bid, manage your team, and track live results.</p>

              <AnimatePresence mode="wait">
                {confirmSent ? (
                  <motion.div key="confirm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-6 space-y-3">
                    <div className="w-11 h-11 rounded-full bg-success/10 flex items-center justify-center mx-auto">
                      <Mail className="w-5 h-5 text-success" />
                    </div>
                    <h3 className="font-display font-semibold text-ink">Check your inbox</h3>
                    <p className="text-ink-muted text-sm">Confirmation link sent to <span className="text-ink">{email}</span>.</p>
                  </motion.div>
                ) : (
                  <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                    <div className="flex gap-1 p-1 bg-surface-2 rounded-lg mb-5">
                      {(['google', 'email'] as const).map(m => (
                        <button
                          key={m}
                          onClick={() => { setAuthMode(m); setError(null); }}
                          className={cn(
                            "flex-1 py-2 rounded-md text-xs font-medium transition-colors capitalize",
                            authMode === m ? "bg-surface-3 text-ink shadow-sm" : "text-ink-muted hover:text-ink"
                          )}
                        >
                          {m}
                        </button>
                      ))}
                    </div>

                    {authMode === 'google' ? (
                      <button
                        onClick={handleGoogleLogin}
                        disabled={loading}
                        className="w-full h-12 bg-ink text-base rounded-lg font-medium text-sm flex items-center justify-center gap-2.5 hover:bg-ink/90 active:scale-[0.98] transition-all disabled:opacity-50"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                        Continue with Google
                      </button>
                    ) : (
                      <form onSubmit={handleEmailAuth} className="space-y-3">
                        <div>
                          <label className="block text-[11px] text-ink-muted mb-1.5 font-medium">Email</label>
                          <div className="relative">
                            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-faint" />
                            <input
                              type="email" required value={email}
                              onChange={(e) => setEmail(e.target.value)}
                              className="w-full h-11 bg-surface-2 border border-border rounded-lg pl-10 pr-3 text-sm text-ink placeholder:text-ink-faint focus:outline-none focus:border-accent transition-colors"
                              placeholder="you@team.com"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="block text-[11px] text-ink-muted mb-1.5 font-medium">Password</label>
                          <div className="relative">
                            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-faint" />
                            <input
                              type={showPassword ? 'text' : 'password'}
                              required minLength={6} value={password}
                              onChange={(e) => setPassword(e.target.value)}
                              className="w-full h-11 bg-surface-2 border border-border rounded-lg pl-10 pr-10 text-sm text-ink placeholder:text-ink-faint focus:outline-none focus:border-accent transition-colors"
                              placeholder="••••••••"
                            />
                            <button type="button" onClick={() => setShowPassword(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-faint hover:text-ink-muted">
                              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                          </div>
                        </div>

                        {error && (
                          <div className="flex items-start gap-2 text-danger text-xs bg-danger/10 rounded-lg px-3 py-2.5">
                            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" /><span>{error}</span>
                          </div>
                        )}
                        {resetSent && (
                          <div className="text-success text-xs bg-success/10 rounded-lg px-3 py-2.5">Reset link sent. Check your inbox.</div>
                        )}

                        <button
                          type="submit" disabled={loading}
                          className="w-full h-11 bg-accent hover:bg-accent-hover text-accent-ink rounded-lg font-semibold text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-all disabled:opacity-50"
                        >
                          {isSignUp ? 'Create account' : 'Sign in'}
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>

                        <div className="flex items-center justify-between pt-1 text-xs">
                          <button type="button" onClick={() => { setIsSignUp(v => !v); setError(null); }} className="text-ink-muted hover:text-ink transition-colors">
                            {isSignUp ? 'Have an account? Sign in' : "Need an account? Sign up"}
                          </button>
                          {!isSignUp && (
                            <button type="button" onClick={handleResetPassword} className="text-ink-faint hover:text-ink-muted transition-colors">Forgot?</button>
                          )}
                        </div>
                      </form>
                    )}

                    {authMode === 'google' && error && (
                      <div className="flex items-start gap-2 text-danger text-xs bg-danger/10 rounded-lg px-3 py-2.5 mt-3">
                        <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" /><span>{error}</span>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </div>
      </main>

      {/* === Bottom ticker === */}
      <div className="relative z-10 border-t border-border bg-surface/40 backdrop-blur-sm">
        <div className="ticker-scroll flex items-center gap-12 py-3 px-4">
          {recentSales.length > 0 ? (
            [...recentSales, ...recentSales].map((sale, i) => (
              <div key={i} className="flex items-center gap-2 whitespace-nowrap">
                <span className="w-1 h-1 rounded-full bg-success flex-shrink-0" />
                <span className="text-xs text-ink-muted">
                  <span className="text-ink font-medium">{sale.name}</span>{' '}to{' '}
                  <span className="text-ink font-medium">{(sale as any).sold_to?.name || 'franchise'}</span>{' '}for{' '}
                  <span className="tnum text-accent font-semibold">{sale.sold_price}</span>
                </span>
              </div>
            ))
          ) : (
            [1, 2, 3].map(i => (
              <div key={i} className="flex items-center gap-2 whitespace-nowrap">
                <span className="w-1 h-1 rounded-full bg-ink-faint flex-shrink-0" />
                <span className="text-xs text-ink-faint uppercase tracking-wide">Draft season opens soon</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function StatPill({ value, label, accent }: { value: number; label: string; accent?: boolean }) {
  return (
    <div>
      <span className={cn("tnum text-xl font-semibold", accent ? "text-accent" : "text-ink")}>{value}</span>
      <span className="text-[10px] text-ink-faint uppercase tracking-wide ml-1">{label}</span>
    </div>
  );
}

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from '../lib/supabase';
import { Mail, Lock, ArrowRight, AlertCircle, Chrome, Eye, EyeOff } from 'lucide-react';
import { cn } from '../lib/utils';

interface LandingScreenProps {
  onLogin: (mockUser?: any) => void;
}

const staggerContainer = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08, delayChildren: 0.1 } },
};
const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] } },
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
          setStats({
            teams: teamCount,
            players: playerCount,
            pool: totalPool || (teamCount * 100)
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
      setError("Enter your email first, then request a reset link.");
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
    <div className="min-h-screen bg-base text-ink font-sans">
      {/* Ticker */}
      <div className="w-full bg-surface border-b border-border overflow-hidden">
        <div className="ticker-scroll flex items-center gap-10 py-2.5">
          {recentSales.length > 0 ? (
            [...recentSales, ...recentSales].map((sale, i) => (
              <div key={i} className="flex items-center gap-2 whitespace-nowrap px-2">
                <span className="w-1 h-1 rounded-full bg-success" />
                <span className="text-xs text-ink-muted">
                  <span className="text-ink font-medium">{sale.name}</span> to{' '}
                  <span className="text-ink font-medium">{(sale as any).sold_to?.name || 'a franchise'}</span> for{' '}
                  <span className="tnum text-accent">{sale.sold_price} VFL</span>
                </span>
              </div>
            ))
          ) : (
            [1, 2].map(i => (
              <div key={i} className="flex items-center gap-2 whitespace-nowrap px-2">
                <span className="text-xs text-ink-faint uppercase tracking-wide">Draft season opens soon</span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Main split layout */}
      <main className="relative grid lg:grid-cols-2 min-h-[calc(100dvh-40px)] overflow-hidden">
        <div className="stadium-texture" />
        <div className="pitch-arc w-[560px] h-[560px] -left-64 -bottom-64 hidden lg:block" />
        <div className="pitch-arc w-[280px] h-[280px] -left-24 -bottom-24 hidden lg:block" />

        {/* Left: brand + content */}
        <div className="relative flex flex-col justify-center px-6 sm:px-12 lg:px-16 py-16">
          <motion.div
            variants={staggerContainer}
            initial="hidden"
            animate="show"
            className="max-w-md mx-auto lg:mx-0 w-full"
          >
            <motion.div variants={fadeUp} className="mb-10 flex items-center gap-2.5">
              <motion.svg
                width="32" height="32" viewBox="0 0 32 32" fill="none"
                initial={{ scale: 0, rotate: -30 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: 'spring', stiffness: 200, damping: 14, delay: 0.15 }}
              >
                <circle cx="16" cy="16" r="15" stroke="var(--color-accent)" strokeWidth="1.5" />
                <path d="M16 8L17.85 13.54H23.7L18.93 16.96L20.78 22.5L16 19.08L11.22 22.5L13.07 16.96L8.3 13.54H14.15L16 8Z" fill="var(--color-accent)" />
              </motion.svg>
              <span className="font-display font-semibold text-sm tracking-tight text-ink-muted">Vedam Football League</span>
            </motion.div>

            <motion.h1 variants={fadeUp} className="font-hype text-5xl sm:text-6xl leading-[0.95] tracking-tight text-ink mb-4 uppercase">
              Draft night,<br />run in real time.
            </motion.h1>
            <motion.p variants={fadeUp} className="text-ink-muted text-base leading-relaxed mb-10 max-w-sm">
              Sign in to bid live for players, track your squad's budget, and watch every sale as it happens.
            </motion.p>

            {/* Live stats */}
            <motion.div variants={fadeUp} className="grid grid-cols-3 gap-4 mb-10 pb-10 border-b border-border">
              <div>
                <div className="tnum text-2xl font-semibold text-ink">{stats.teams}</div>
                <div className="text-[11px] text-ink-faint uppercase tracking-wide mt-0.5">Franchises</div>
              </div>
              <div>
                <div className="tnum text-2xl font-semibold text-ink">{stats.players}</div>
                <div className="text-[11px] text-ink-faint uppercase tracking-wide mt-0.5">Players</div>
              </div>
              <div>
                <div className="tnum text-2xl font-semibold text-ink">{stats.pool.toLocaleString()}</div>
                <div className="text-[11px] text-ink-faint uppercase tracking-wide mt-0.5">VFL pool</div>
              </div>
            </motion.div>

            {/* Auth card */}
            <motion.div variants={fadeUp} className="bg-surface border border-border rounded-2xl p-6">
              <AnimatePresence mode="wait">
                {confirmSent ? (
                  <motion.div
                    key="confirm"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-center py-4 space-y-3"
                  >
                    <div className="w-10 h-10 rounded-full bg-success/10 flex items-center justify-center mx-auto">
                      <Mail className="w-5 h-5 text-success" />
                    </div>
                    <h3 className="font-display font-semibold text-ink">Check your inbox</h3>
                    <p className="text-ink-muted text-sm leading-relaxed">
                      We sent a confirmation link to <span className="text-ink">{email}</span>.
                    </p>
                  </motion.div>
                ) : (
                  <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                    <div className="flex gap-1 p-1 bg-surface-2 rounded-lg mb-5">
                      <button
                        onClick={() => { setAuthMode('google'); setError(null); }}
                        className={cn(
                          "flex-1 py-2 rounded-md text-xs font-medium transition-colors",
                          authMode === 'google' ? "bg-surface-3 text-ink" : "text-ink-muted hover:text-ink"
                        )}
                      >
                        Google
                      </button>
                      <button
                        onClick={() => { setAuthMode('email'); setError(null); }}
                        className={cn(
                          "flex-1 py-2 rounded-md text-xs font-medium transition-colors",
                          authMode === 'email' ? "bg-surface-3 text-ink" : "text-ink-muted hover:text-ink"
                        )}
                      >
                        Email
                      </button>
                    </div>

                    {authMode === 'google' ? (
                      <button
                        onClick={handleGoogleLogin}
                        disabled={loading}
                        className="w-full h-12 bg-ink text-base rounded-lg font-medium text-sm flex items-center justify-center gap-2.5 hover:bg-ink/90 transition-colors disabled:opacity-50"
                      >
                        <Chrome className="w-4 h-4" />
                        Continue with Google
                      </button>
                    ) : (
                      <form onSubmit={handleEmailAuth} className="space-y-3">
                        <div>
                          <label className="block text-xs text-ink-muted mb-1.5">Email</label>
                          <div className="relative">
                            <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-faint" />
                            <input
                              type="email"
                              required
                              value={email}
                              onChange={(e) => setEmail(e.target.value)}
                              className="w-full h-11 bg-surface-2 border border-border rounded-lg pl-10 pr-3 text-sm text-ink placeholder:text-ink-faint focus:outline-none focus:border-accent transition-colors"
                              placeholder="you@franchise.com"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs text-ink-muted mb-1.5">Password</label>
                          <div className="relative">
                            <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-faint" />
                            <input
                              type={showPassword ? 'text' : 'password'}
                              required
                              minLength={6}
                              value={password}
                              onChange={(e) => setPassword(e.target.value)}
                              className="w-full h-11 bg-surface-2 border border-border rounded-lg pl-10 pr-10 text-sm text-ink placeholder:text-ink-faint focus:outline-none focus:border-accent transition-colors"
                              placeholder="••••••••"
                            />
                            <button
                              type="button"
                              onClick={() => setShowPassword(v => !v)}
                              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-ink-faint hover:text-ink-muted"
                            >
                              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                          </div>
                        </div>

                        {error && (
                          <div className="flex items-start gap-2 text-danger text-xs bg-danger/10 rounded-lg px-3 py-2.5">
                            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                            <span>{error}</span>
                          </div>
                        )}
                        {resetSent && (
                          <div className="text-success text-xs bg-success/10 rounded-lg px-3 py-2.5">
                            Reset link sent. Check your inbox.
                          </div>
                        )}

                        <button
                          type="submit"
                          disabled={loading}
                          className="w-full h-11 bg-accent hover:bg-accent-hover text-accent-ink rounded-lg font-medium text-sm flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                        >
                          {isSignUp ? 'Create account' : 'Sign in'}
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>

                        <div className="flex items-center justify-between pt-1 text-xs">
                          <button
                            type="button"
                            onClick={() => { setIsSignUp(v => !v); setError(null); }}
                            className="text-ink-muted hover:text-ink transition-colors"
                          >
                            {isSignUp ? 'Have an account? Sign in' : "Need an account? Sign up"}
                          </button>
                          {!isSignUp && (
                            <button
                              type="button"
                              onClick={handleResetPassword}
                              className="text-ink-faint hover:text-ink-muted transition-colors"
                            >
                              Forgot password?
                            </button>
                          )}
                        </div>
                      </form>
                    )}

                    {authMode === 'google' && error && (
                      <div className="flex items-start gap-2 text-danger text-xs bg-danger/10 rounded-lg px-3 py-2.5 mt-3">
                        <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                        <span>{error}</span>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          </motion.div>
        </div>

        {/* Right: image panel */}
        <div className="relative hidden lg:block overflow-hidden bg-surface">
          <img
            src="https://picsum.photos/seed/vfl-stadium-night/1400/1600"
            alt=""
            className="w-full h-full object-cover grayscale opacity-60"
            style={{ filter: 'grayscale(1) brightness(0.85)' }}
          />
          <div className="absolute inset-0 bg-accent mix-blend-color opacity-40" />
          <div className="absolute inset-0 bg-gradient-to-t from-base via-base/30 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-l from-transparent via-transparent to-base/70" />
          <div className="absolute top-12 right-12">
            <svg width="120" height="120" viewBox="0 0 120 120" fill="none" className="opacity-[0.08]">
              <circle cx="60" cy="60" r="58" stroke="white" strokeWidth="1" />
              <circle cx="60" cy="60" r="30" stroke="white" strokeWidth="1" />
            </svg>
          </div>
          <div className="absolute bottom-12 left-12 right-12">
            <p className="font-display text-2xl font-medium text-ink leading-snug max-w-sm">
              Every bid, every sale, synced to the whole league instantly.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}

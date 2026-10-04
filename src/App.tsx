import React, { useState, useEffect, lazy, Suspense } from 'react';
import { supabase } from './lib/supabase';
import type { User } from '@supabase/supabase-js';
import { X } from 'lucide-react';

// Each screen is a separate chunk: a bidder never downloads the admin console.
// Keeping every screen out of the entry also keeps the animation library out of
// it, so the entry can run the session check while the rest still downloads.
const loadLanding = () => import('./components/LandingScreen');
const LandingScreen = lazy(loadLanding);
// Warm the landing chunk immediately — a logged-out visitor needs it the moment
// the session check comes back empty.
loadLanding();

// Navbar shows only once a screen is up, and shares the animation library with
// it, so deferring it keeps that library out of the entry at no extra cost.
const Navbar = lazy(() => import('./components/Navbar'));
const AdminDashboard = lazy(() => import('./components/AdminDashboard'));
const PlayerDirectory = lazy(() => import('./components/PlayerDirectory'));
const LiveAuction = lazy(() => import('./components/LiveAuction'));
const TeamSquads = lazy(() => import('./components/TeamSquads'));
const UserProfile = lazy(() => import('./components/UserProfile'));

type Screen = 'landing' | 'admin' | 'directory' | 'auction' | 'watchlist' | 'team' | 'profile';

const Spinner = () => (
  <div className="min-h-screen bg-base flex items-center justify-center">
    <div className="w-6 h-6 border-2 border-border-strong border-t-accent rounded-full animate-spin" />
  </div>
);

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<Screen>('landing');
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [announcement, setAnnouncement] = useState<any>(null);

  useEffect(() => {
    const saved = localStorage.getItem('vfl_current_screen') as Screen;
    if (saved) setCurrentScreen(saved);
  }, []);

  useEffect(() => {
    if (currentScreen !== 'landing') {
      localStorage.setItem('vfl_current_screen', currentScreen);
    }
  }, [currentScreen]);

  useEffect(() => {
    const annSub = supabase
      .channel('announcements-live')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'announcements' }, (payload: any) => {
        setAnnouncement(payload.new);
        const ttl = payload.new.expires_at
          ? Math.max(0, new Date(payload.new.expires_at).getTime() - Date.now())
          : 10_000;
        setTimeout(() => setAnnouncement(null), ttl);
      })
      .subscribe();

    supabase.auth.getSession().then(({ data: { session } }) => {
      const u = session?.user ?? null;
      setUser(u);
      if (u) {
        syncUserProfile(u);
        setCurrentScreen(prev => {
          if (prev === 'landing') return 'directory';
          return prev;
        });
      }
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      const u = session?.user ?? null;
      
      if (event === 'SIGNED_OUT') {
        setUser(null);
        setIsAdmin(false);
        setCurrentScreen('landing');
        return;
      }

      if (u) {
        setUser(u);
        syncUserProfile(u);
        if (event === 'SIGNED_IN') {
          setCurrentScreen(prev => prev === 'landing' ? 'directory' : prev);
        }
      }
    });

    return () => {
      if (annSub) supabase.removeChannel(annSub);
      if (subscription) subscription.unsubscribe();
    };
  }, []);

  async function syncUserProfile(user: User) {
    // The row is created by the sign-up trigger (and the browser has no write access to
    // users under RLS), so only read the role here.
    const { data, error } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();

    if (error) console.error('Error syncing profile:', error.message);
    
    if (data?.role === 'ADMIN') {
      setIsAdmin(true);
    } else {
      setIsAdmin(false);
    }
  }

  const renderScreen = () => {
    if (loading) return <Spinner />;

    if (!user) return <LandingScreen onLogin={() => setCurrentScreen('directory')} />;

    switch (currentScreen) {
      case 'landing':
        return <LandingScreen onLogin={() => setCurrentScreen('directory')} />;
      case 'admin':
        return isAdmin ? <AdminDashboard user={user} /> : <PlayerDirectory user={user} />;
      case 'directory':
        return <PlayerDirectory user={user} />;
      case 'auction':
        return <LiveAuction user={user} />;
      case 'profile':
        return <UserProfile user={user} onLogout={() => supabase.auth.signOut()} />;
      case 'team':
        return <TeamSquads user={user} />;
      case 'watchlist':
        return (
          <div className="min-h-screen bg-base flex flex-col items-center justify-center gap-3 text-center px-6 pb-32">
            <h2 className="font-display text-2xl font-semibold text-ink-muted">Watchlist coming soon</h2>
            <p className="text-ink-faint text-sm max-w-xs">Save players to follow them during the auction.</p>
          </div>
        );
      default:
        return <PlayerDirectory user={user} />;
    }
  };

  return (
    <div className="relative min-h-screen">
      {announcement && (
        <div className="banner-drop fixed top-4 left-0 right-0 z-[200] max-w-lg mx-auto px-4">
          <div className="bg-accent text-accent-ink px-5 py-3.5 rounded-xl flex items-center justify-between gap-4 shadow-xl">
            <p className="text-sm font-medium truncate">{announcement.message}</p>
            <button
              onClick={() => setAnnouncement(null)}
              className="p-1 hover:bg-black/10 rounded-full transition-colors flex-shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
      <Suspense fallback={<Spinner />}>{renderScreen()}</Suspense>
      {currentScreen !== 'landing' && user && (
        <Suspense fallback={null}>
          <Navbar
            currentScreen={currentScreen}
            setCurrentScreen={(s: Screen) => setCurrentScreen(s)}
            isAdmin={isAdmin}
          />
        </Suspense>
      )}
    </div>
  );
}

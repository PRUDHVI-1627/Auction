import React, { useState, useEffect } from 'react';
import LandingScreen from './components/LandingScreen';
import AdminDashboard from './components/AdminDashboard';
import PlayerDirectory from './components/PlayerDirectory';
import LiveAuction from './components/LiveAuction';
import TeamSquads from './components/TeamSquads';
import UserProfile from './components/UserProfile';
import Navbar from './components/Navbar';
import { supabase } from './lib/supabase';
import type { User } from '@supabase/supabase-js';
import { motion, AnimatePresence } from 'motion/react';
import { X } from 'lucide-react';

type Screen = 'landing' | 'admin' | 'directory' | 'auction' | 'watchlist' | 'team' | 'profile';

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
    const { data, error } = await supabase
      .from('users')
      .upsert({
        id: user.id,
        email: user.email || '',
        name: user.user_metadata.full_name || user.email?.split('@')[0] || 'VFL Legend',
        avatar_url: user.user_metadata.avatar_url,
      }, { onConflict: 'id' })
      .select('role')
      .single();
    
    if (error) console.error('Error syncing profile:', error.message);
    
    if (data?.role === 'ADMIN') {
      setIsAdmin(true);
    } else {
      setIsAdmin(false);
    }
  }

  const renderScreen = () => {
    if (loading) return (
      <div className="min-h-screen bg-base flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-border-strong border-t-accent rounded-full animate-spin" />
      </div>
    );

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
      <AnimatePresence>
        {announcement && (
          <motion.div
            initial={{ y: -60, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -60, opacity: 0 }}
            className="fixed top-4 left-0 right-0 z-[200] max-w-lg mx-auto px-4"
          >
             <div className="bg-accent text-accent-ink px-5 py-3.5 rounded-xl flex items-center justify-between gap-4 shadow-xl">
                <p className="text-sm font-medium truncate">{announcement.message}</p>
                <button
                  onClick={() => setAnnouncement(null)}
                  className="p-1 hover:bg-black/10 rounded-full transition-colors flex-shrink-0"
                >
                   <X className="w-4 h-4" />
                </button>
             </div>
          </motion.div>
        )}
      </AnimatePresence>
      {renderScreen()}
      {currentScreen !== 'landing' && user && (
        <Navbar 
          currentScreen={currentScreen} 
          setCurrentScreen={(s: Screen) => setCurrentScreen(s)} 
          isAdmin={isAdmin}
        />
      )}
    </div>
  );
}

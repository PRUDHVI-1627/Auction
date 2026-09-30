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
    if (loading) return <div className="min-h-screen bg-surface flex items-center justify-center text-primary font-black animate-pulse uppercase tracking-[1em]">VFL Loading...</div>;

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
          <div className="min-h-screen bg-surface flex flex-col items-center justify-center gap-4 text-center px-6 pb-32">
            <div className="text-6xl opacity-10">♥</div>
            <h2 className="font-headline font-black italic uppercase text-3xl text-white/20 tracking-tighter">Watchlist</h2>
            <p className="text-white/20 font-label text-xs uppercase tracking-widest">Coming soon — save players to follow them during the auction</p>
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
            initial={{ y: -100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -100, opacity: 0 }}
            className="fixed top-0 left-0 right-0 z-[200] max-w-2xl mx-auto mt-4 px-4"
          >
             <div className="bg-primary text-surface px-6 py-4 rounded-2xl flex items-center justify-between shadow-[0_20px_50px_rgba(0,0,0,0.5)] border border-white/20 backdrop-blur-md">
                <div className="flex items-center gap-4 overflow-hidden">
                   <div className="px-2 py-1 bg-surface text-primary text-[8px] font-black uppercase rounded shadow-inner animate-pulse">Live Feed</div>
                   <p className="font-label font-bold text-sm uppercase tracking-wide truncate">{announcement.message}</p>
                </div>
                <button 
                  onClick={() => setAnnouncement(null)}
                  className="hover:scale-110 transition-transform p-1 hover:bg-black/10 rounded-full"
                >
                   <X className="w-5 h-5" />
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

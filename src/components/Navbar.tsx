import { LayoutGrid, Gavel, Heart, Users, ShieldCheck, CircleUser } from 'lucide-react';
import { cn } from '../lib/utils';
import { motion } from 'motion/react';

type ScreenID = 'landing' | 'admin' | 'directory' | 'auction' | 'watchlist' | 'team' | 'profile';

interface NavbarProps {
  currentScreen: string;
  setCurrentScreen: (screen: ScreenID) => void;
  isAdmin?: boolean;
}

export default function Navbar({ currentScreen, setCurrentScreen, isAdmin }: NavbarProps) {
  const navItems: { id: ScreenID; label: string; icon: any }[] = [
    { id: 'directory', label: 'Players', icon: LayoutGrid },
    { id: 'auction', label: 'Live', icon: Gavel },
    { id: 'team', label: 'Squads', icon: Users },
  ];

  if (isAdmin) {
    navItems.push({ id: 'admin', label: 'Admin', icon: ShieldCheck });
  } else {
    navItems.push({ id: 'watchlist', label: 'Watch', icon: Heart });
  }
  navItems.push({ id: 'profile', label: 'You', icon: CircleUser });

  return (
    <nav className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[100] bg-surface-2/90 backdrop-blur-xl border border-border rounded-2xl px-1 py-1 flex items-center gap-0.5 shadow-[0_8px_40px_rgba(0,0,0,0.6)]">
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = currentScreen === item.id;

        return (
          <button
            key={item.id}
            onClick={() => setCurrentScreen(item.id)}
            className={cn(
              "relative flex flex-col items-center justify-center gap-0.5 w-16 py-2.5 rounded-xl transition-colors",
              isActive ? "text-accent-ink" : "text-ink-faint hover:text-ink-muted"
            )}
          >
            {isActive && (
              <motion.div
                layoutId="nav-pill"
                className="absolute inset-0 bg-accent rounded-xl"
                transition={{ type: "spring", bounce: 0.15, duration: 0.5 }}
              />
            )}
            <Icon className="w-[18px] h-[18px] relative z-10" strokeWidth={isActive ? 2.25 : 1.75} />
            <span className="text-[8px] font-bold uppercase tracking-widest relative z-10">{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

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
        navItems.push({ id: 'watchlist', label: 'Watchlist', icon: Heart });
    }
    navItems.push({ id: 'profile', label: 'Profile', icon: CircleUser });

    return (
        <nav className="fixed bottom-5 left-1/2 -translate-x-1/2 z-[100] bg-surface-2/95 backdrop-blur-md border border-border rounded-xl p-1.5 flex items-center gap-1 shadow-[0_12px_32px_rgba(0,0,0,0.5)]">
            {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = currentScreen === item.id;

                return (
                    <button
                        key={item.id}
                        onClick={() => setCurrentScreen(item.id)}
                        className={cn(
                            "relative flex flex-col items-center justify-center gap-1 px-5 py-2 rounded-lg transition-colors",
                            isActive ? "text-accent-ink" : "text-ink-muted hover:text-ink"
                        )}
                    >
                        {isActive && (
                            <motion.div
                                layoutId="nav-active-pill"
                                className="absolute inset-0 bg-accent rounded-lg"
                                transition={{ type: "spring", bounce: 0.2, duration: 0.5 }}
                            />
                        )}
                        <Icon className="w-[18px] h-[18px] relative z-10" strokeWidth={isActive ? 2.25 : 1.75} />
                        <span className="text-[9px] font-semibold uppercase tracking-wide relative z-10">{item.label}</span>
                    </button>
                );
            })}
        </nav>
    );
}

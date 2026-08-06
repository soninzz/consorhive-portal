'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import { LayoutDashboard, Users, MessageSquare, ListChecks, Settings, BookOpen, Megaphone } from 'lucide-react';

const menuItems = [
  { name: 'Dashboard', icon: LayoutDashboard, path: '/dashboard' },
  { name: 'Leads', icon: Users, path: '/leads' },
  { name: 'Conversas', icon: MessageSquare, path: '/conversas' },
  { name: 'Listas', icon: ListChecks, path: '/listas' },
  { name: 'Campanhas', icon: Megaphone, path: '/campanhas' },
  { name: 'Base de Conhecimento', icon: BookOpen, path: '/base-conhecimento' },
  { name: 'Configurações', icon: Settings, path: '/configuracoes' },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="bg-honeycomb-dark dark relative z-10 hidden h-screen w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar/95 p-4 backdrop-blur-xl md:flex">
      <div className="mb-8 flex items-center gap-2.5 p-2">
        <span className="hex-icon relative flex h-9 w-9 items-center justify-center bg-gradient-to-br from-primary to-primary/40">
          <span className="absolute inset-0 animate-pulse-glow bg-primary/40 blur-md" />
          <span className="hex-icon relative h-3.5 w-3.5 scale-[0.6] bg-background" />
        </span>
        <h1 className="text-xl font-bold tracking-tight text-gradient-gold">ConsorHive</h1>
      </div>

      <nav className="flex flex-col gap-1">
        {menuItems.map((item, i) => {
          const active = pathname === item.path || pathname?.startsWith(item.path + '/');
          return (
            <motion.div
              key={item.name}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.04, duration: 0.3, ease: 'easeOut' }}
            >
              <Link
                href={item.path}
                className={`group relative flex items-center gap-3 rounded-lg px-4 py-2.5 text-sm transition-all ${
                  active
                    ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                    : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground'
                }`}
              >
                {active && (
                  <motion.span
                    layoutId="sidebar-active"
                    className="hex-cell absolute left-0 top-1/2 h-4 w-2 -translate-y-1/2 bg-primary shadow-[0_0_10px_rgba(var(--glow-gold),0.6)]"
                    transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                  />
                )}
                <item.icon
                  size={18}
                  className={active ? 'text-primary' : 'text-sidebar-foreground/70 group-hover:text-sidebar-foreground'}
                />
                <span>{item.name}</span>
              </Link>
            </motion.div>
          );
        })}
      </nav>

      <div className="mt-auto rounded-xl border border-sidebar-border bg-sidebar-accent/40 p-3 text-xs text-sidebar-foreground/70">
        Agentes de IA integrados ao WhatsApp da sua operação.
      </div>
    </aside>
  );
}

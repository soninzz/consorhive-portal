'use client';
import Link from 'next/link';
import { LayoutDashboard, Users, MessageSquare, ListChecks, Settings, BookOpen, Megaphone } from 'lucide-react';

// src/components/dashboard/Sidebar.tsx

export function Sidebar() {
  const menuItems = [
  { name: 'Dashboard', icon: LayoutDashboard, path: '/dashboard' },
  { name: 'Leads', icon: Users, path: '/leads' },
  { name: 'Conversas', icon: MessageSquare, path: '/conversas' },
  { name: 'Listas', icon: ListChecks, path: '/listas' },
  { name: 'Campanhas', icon: Megaphone, path: '/campanhas' },
  { name: 'Base de Conhecimento', icon: BookOpen, path: '/base-conhecimento' },
  { name: 'Configurações', icon: Settings, path: '/configuracoes' },
];

  // ... restante do código permanece igual

  return (
    <div className="w-64 bg-slate-950 border-r border-slate-800 p-4 hidden md:block h-screen">
      <div className="mb-8 p-2">
        <h1 className="text-xl font-bold text-white tracking-tight">ConsorHive</h1>
      </div>
      <nav className="space-y-2">
        {menuItems.map((item) => (
          <Link 
            key={item.name} 
            href={item.path}
            className="flex items-center space-x-3 px-4 py-3 text-slate-400 hover:bg-slate-900 hover:text-white rounded-lg transition-all"
          >
            <item.icon size={20} />
            <span>{item.name}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}
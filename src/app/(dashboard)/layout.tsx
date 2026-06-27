import { Sidebar } from "@/app/(dashboard)/dashboard/Sidebar";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen bg-slate-950 text-slate-50">
      {/* Aqui ele chama o componente da Sidebar que criamos */}
      <Sidebar />
      <main className="flex-1 overflow-y-auto p-0">
        {children}
      </main>
    </div>
  );
}
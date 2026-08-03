import { Sidebar } from "@/app/(dashboard)/dashboard/Sidebar";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex h-screen overflow-hidden bg-hive text-foreground">
      {/* Glows ambiente — fixos, não competem com o conteúdo */}
      <div className="glow-blob glow-blob-gold animate-pulse-glow -left-32 -top-32 h-96 w-96" />
      <div className="glow-blob glow-blob-violet animate-drift right-0 top-1/3 h-[28rem] w-[28rem]" />
      <div className="glow-blob glow-blob-teal bottom-0 left-1/3 h-72 w-72 opacity-60" />

      <Sidebar />
      <main className="relative z-10 flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}

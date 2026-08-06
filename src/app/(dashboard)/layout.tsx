import { Sidebar } from "@/app/(dashboard)/dashboard/Sidebar";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex h-screen overflow-hidden bg-background text-foreground">
      <Sidebar />
      <main className="relative z-10 flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}

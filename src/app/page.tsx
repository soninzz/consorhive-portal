import { redirect } from "next/navigation";

export default function Home() {
  // Para a V1.0, vamos direto para o dashboard
  redirect("/dashboard");
}
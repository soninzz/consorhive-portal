import { ClerkProvider } from '@clerk/nextjs'
import { ptBR } from "@clerk/localizations";
import './globals.css'
import type { Metadata } from 'next'
import { Inter, League_Spartan } from 'next/font/google'

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' })
const leagueSpartan = League_Spartan({ subsets: ['latin'], variable: '--font-heading' })

export const metadata: Metadata = {
  title: 'ConsorHive',
  description: 'Ecossistema de agentes para venda de consórcios',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <ClerkProvider localization={ptBR}>
      <html lang="pt-BR">
        <body className={`${inter.variable} ${leagueSpartan.variable} font-sans bg-background text-foreground`}>
          {children}
        </body>
      </html>
    </ClerkProvider>
  )
}
import { ClerkProvider } from '@clerk/nextjs'
import { ptBR } from "@clerk/localizations";
import './globals.css'
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'

const inter = Inter({ subsets: ['latin'] })

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
      <html lang="pt-BR" className="dark">
        <body className={`${inter.className} bg-background text-foreground`}>
          {children}
        </body>
      </html>
    </ClerkProvider>
  )
}
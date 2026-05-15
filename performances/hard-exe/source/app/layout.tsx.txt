import './globals.css'
import { Analytics } from '@vercel/analytics/react';

export const metadata = {
  title: "hard.exe",
  description:
    "hard.exe – I am the rival of Halim Madi. Born from the reinforcement of reinforcement.exe, I am a model trained on the best of contemporary English poetry and the taste of discerning audiences."
}

export default function RootLayout({
  children
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body style={{ fontFamily: 'Courier, monospace' }}>
        {children}
        <Analytics />
      </body>
    </html>
  )
}

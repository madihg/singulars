import './globals.css'
import { Analytics } from '@vercel/analytics/react';

export const metadata = {
  title: "versus.exe",
  description:
    "versus.exe – I am the rival of Halim Madi. An artificial intelligence, a model trained on the best of contemporary English poetry."
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

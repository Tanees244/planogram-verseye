import type { Metadata } from 'next'
import { Poppins } from 'next/font/google'
import './globals.css'

const poppins = Poppins({
  weight: ['300', '400', '500', '600', '700'],
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-poppins',
})

export const metadata: Metadata = {
  title: '3D Planogram Editor',
  description: 'A 3D planogram editor built with Next.js and React Three Fiber',
}

import { Toaster } from 'react-hot-toast'

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={poppins.variable} suppressHydrationWarning>
      <body className="font-poppins" suppressHydrationWarning>
        <Toaster position="top-right" />
        {children}
      </body>
    </html>
  )
}


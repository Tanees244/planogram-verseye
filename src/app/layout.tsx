import type { Metadata } from 'next'
import localFont from 'next/font/local'
import './globals.css'

const poppins = localFont({
  src: [
    { path: './fonts/poppins-latin-300-normal.woff2', weight: '300', style: 'normal' },
    { path: './fonts/poppins-latin-400-normal.woff2', weight: '400', style: 'normal' },
    { path: './fonts/poppins-latin-500-normal.woff2', weight: '500', style: 'normal' },
    { path: './fonts/poppins-latin-600-normal.woff2', weight: '600', style: 'normal' },
    { path: './fonts/poppins-latin-700-normal.woff2', weight: '700', style: 'normal' },
  ],
  display: 'swap',
  variable: '--font-poppins',
})

export const metadata: Metadata = {
  title: '3D Planogram Editor',
  description: 'A 3D planogram editor built with Next.js and React Three Fiber',
  icons: {
    icon: [{ url: '/favicon.png', type: 'image/png' }],
    apple: [{ url: '/favicon.png', type: 'image/png' }],
  },
}

import { Toaster } from 'react-hot-toast'
import SessionExpiryHandler from '@/components/SessionExpiryHandler'

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={poppins.variable} suppressHydrationWarning>
      <body className="font-poppins" suppressHydrationWarning>
        <Toaster position="top-right" />
        <SessionExpiryHandler />
        {children}
      </body>
    </html>
  )
}


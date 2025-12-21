import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import "./globals.css"

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
})

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
})

export const metadata: Metadata = {
  title: "Goodwin - Price Calculator",
  description: "Price calculator",
  icons: [
    { rel: "shortcut icon", url: "/goodwin_calc.png", type: "image/x-icon" },
  ],
  openGraph: {
    title: "Goodwin - Price Calculator",
    description: "Price calculator",
    images: ["goodwin_calc.png"],
    type: "website",
  },
  twitter: {
    title: "Goodwin - Price Calculator",
    description: "Price calculator",
    images: ["goodwin_calc.png"],
    card: "summary_large_image",
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  )
}

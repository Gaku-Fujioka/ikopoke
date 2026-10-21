import type { Metadata } from "next";
import { Geist } from "next/font/google";
import { ThemeProvider } from "next-themes";
import "./globals.css";
import "./palette.css";
import "./social.css";

const defaultUrl = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : "http://localhost:3000";

const appName = "いこポケ";
const appDescription = "行きたい候補を共有し、おでかけと思い出につなげるアプリ";

export const metadata: Metadata = {
  metadataBase: new URL(defaultUrl),
  applicationName: appName,
  title: appName,
  description: appDescription,
  openGraph: {
    title: appName,
    description: appDescription,
    siteName: appName,
    locale: "ja_JP",
    type: "website",
  },
  twitter: {
    title: appName,
    description: appDescription,
  },
};

const geistSans = Geist({
  variable: "--font-geist-sans",
  display: "swap",
  subsets: ["latin"],
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja" suppressHydrationWarning>
      <body className={`${geistSans.className} antialiased`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}

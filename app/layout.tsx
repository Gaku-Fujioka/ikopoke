import type { Metadata,Viewport } from "next";
import { Geist } from "next/font/google";
import { ThemeProvider } from "next-themes";
import "./globals.css";
import "./palette.css";
import "./social.css";
import "./pocket.css";

// Use the public domain in production; keep preview metadata on its own deployment.
const deploymentHost = process.env.VERCEL_ENV === "production"
  ? process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL
  : process.env.VERCEL_URL;
const defaultUrl = deploymentHost
  ? `https://${deploymentHost}`
  : "http://localhost:3000";

const appName = "いこポケ";
const appDescription = "行きたい候補を共有し、おでかけと思い出につなげるアプリ";

export const metadata: Metadata = {
  metadataBase: new URL(defaultUrl),
  applicationName: appName,
  title: appName,
  description: appDescription,
  appleWebApp:{capable:true,title:appName,statusBarStyle:"default"},
  formatDetection:{telephone:false},
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

export const viewport:Viewport={width:"device-width",initialScale:1,viewportFit:"cover",themeColor:"#ffae45"};

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

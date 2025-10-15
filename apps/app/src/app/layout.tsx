import "~/styles/globals.css";

import type { Metadata } from "next";
import { Geist_Mono, Inter } from "next/font/google";
import { Providers } from "~/lib/providers";

const inter = Inter({ subsets: ["latin"], variable: "--inter" });
const geist_mono = Geist_Mono({ subsets: ["latin"], variable: "--geist-mono" });

export const metadata: Metadata = {
  title: "OpenPoke - AI Agent Chat",
  description:
    "Your AI-powered personal assistant for email triage, smart reminders, and task delegation.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${inter.variable} ${geist_mono.variable} font-sans antialiased`}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

import "~/styles/globals.css";

import type { Metadata } from "next";
import { Geist_Mono, Inter } from "next/font/google";
import { Providers } from "~/lib/providers";

const inter = Inter({ subsets: ["latin"], variable: "--inter" });
const geist_mono = Geist_Mono({ subsets: ["latin"], variable: "--geist-mono" });

export const metadata: Metadata = {
  title: "Carol - Your Health Companion",
  description:
    "An AI assistant focused on emotional wellness and health insurance navigation, here to support your health journey.",
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

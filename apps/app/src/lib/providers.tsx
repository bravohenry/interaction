"use client";

import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { Provider as JotaiProvider } from "jotai";
import { ThemeProvider } from "next-themes";
import { Toaster } from "~/components/ui/sonner";
import { TRPCReactProvider } from "~/trpc/react";

export const Providers = ({ children }: { children: React.ReactNode }) => (
  <JotaiProvider>
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      disableTransitionOnChange
      enableSystem
    >
      <TRPCReactProvider>
        {children}
        <ReactQueryDevtools />
      </TRPCReactProvider>
      <Toaster richColors />
    </ThemeProvider>
  </JotaiProvider>
);

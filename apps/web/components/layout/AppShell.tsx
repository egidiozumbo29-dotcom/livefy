"use client";

import { BalanceSyncSubscriber } from "@/hooks/useBalanceSync";
import { TopHeader } from "./TopHeader";
import { MobileTabBar } from "./MobileTabBar";
import { PwaBootstrap } from "@/components/pwa/PwaBootstrap";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-cam-bg">
      <BalanceSyncSubscriber />
      <PwaBootstrap />
      <TopHeader />
      <main className="relative flex flex-1 flex-col pb-[calc(3.75rem+env(safe-area-inset-bottom))] lg:pb-0">
        {children}
      </main>
      <MobileTabBar />
    </div>
  );
}

"use client";

import { useRef } from "react";
import { Provider } from "react-redux";
import { AuthHydrator } from "@/components/auth/AuthHydrator";
import { PresencePinger } from "@/components/auth/PresencePinger";
import { makeStore, type AppStore } from "@/store";

export function Providers({ children }: { children: React.ReactNode }) {
  const storeRef = useRef<AppStore | null>(null);
  if (!storeRef.current) {
    storeRef.current = makeStore();
  }

  return (
    <Provider store={storeRef.current}>
      <AuthHydrator />
      <PresencePinger />
      {children}
    </Provider>
  );
}

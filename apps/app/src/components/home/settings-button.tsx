"use client";

import { useNavigation } from "~/lib/atoms/navigation";

interface SettingsButtonProps {
  children: React.ReactNode;
}

export function SettingsButton({ children }: SettingsButtonProps) {
  const { setView } = useNavigation();

  return (
    <button
      aria-label="Settings"
      onClick={() => setView("settings")}
      type="button"
    >
      {children}
    </button>
  );
}

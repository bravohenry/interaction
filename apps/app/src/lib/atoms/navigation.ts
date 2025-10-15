"use client";

import { atom, useAtom, useSetAtom } from "jotai";
import type { AccountDetailState, PanelView } from "~/types";

// Navigation atoms
export const viewAtom = atom<PanelView>("home");
export const accountDetailAtom = atom<AccountDetailState | null>(null);

// Navigation actions
export function useNavigation() {
  const [view, setViewState] = useAtom(viewAtom);
  const setAccountDetail = useSetAtom(accountDetailAtom);

  const setView = (newView: PanelView) => {
    // Clear account detail when navigating away from account detail
    if (view === "account-detail" && newView !== "account-detail") {
      setAccountDetail(null);
    }
    setViewState(newView);
  };

  const navigateToAccountDetail = (accountId: string, email: string) => {
    setAccountDetail({ accountId, email });
    setView("account-detail");
  };

  const goBack = () => {
    switch (view) {
      case "account-detail":
        setView("connections");
        break;
      case "connections":
        setView("settings");
        break;
      case "chat":
      case "settings":
        setView("home");
        break;
      default:
        setView("home");
    }
  };

  return {
    view,
    setView,
    navigateToAccountDetail,
    goBack,
  };
}

// Hook for account detail state
export function useAccountDetail() {
  const [accountDetail] = useAtom(accountDetailAtom);
  return accountDetail;
}

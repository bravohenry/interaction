"use client";

import { atom, useAtom } from "jotai";
import type { PanelView } from "~/types";

// Navigation atoms
export const viewAtom = atom<PanelView>("home");

// Navigation actions
export function useNavigation() {
  const [view, setViewState] = useAtom(viewAtom);

  const setView = (newView: PanelView) => {
    setViewState(newView);
  };

  const goBack = () => {
    switch (view) {
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
    goBack,
  };
}

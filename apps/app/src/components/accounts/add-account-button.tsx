"use client";

import { Button } from "~/components/ui/button";
import { useGmailConnect } from "~/lib/hooks/use-gmail-connect";

interface AddAccountButtonProps {
  hasPendingConnections: boolean;
}

export function AddAccountButton({
  hasPendingConnections,
}: AddAccountButtonProps) {
  const { mutate: connect, isPending } = useGmailConnect();

  // Hide button if there are any pending connections
  if (hasPendingConnections) {
    return null;
  }

  return (
    <Button
      className="w-full rounded-xl"
      disabled={isPending}
      onClick={() => connect()}
      variant="outline"
    >
      {isPending ? "Initializing..." : "Add Account"}
    </Button>
  );
}

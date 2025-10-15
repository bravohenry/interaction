"use client";

import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { env } from "~/env";

const PY_API = env.NEXT_PUBLIC_PY_BACKEND_URL;

interface ConnectResponse {
  ok: boolean;
  redirect_url: string;
  connection_request_id: string;
  user_id: string;
  composio_user_id: string;
}

export function useGmailConnect() {
  return useMutation({
    mutationFn: async () => {
      const res = await fetch(`${PY_API}/api/v1/gmail/connect`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });

      if (!res.ok) {
        const error = await res
          .json()
          .catch(() => ({ detail: "Failed to initiate connection" }));
        throw new Error(error.detail || "Failed to initiate connection");
      }

      return res.json() as Promise<ConnectResponse>;
    },
    onSuccess: (data) => {
      if (data.redirect_url) {
        window.location.href = data.redirect_url;
      }
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

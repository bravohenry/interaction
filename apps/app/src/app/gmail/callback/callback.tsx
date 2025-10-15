"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

export function GmailCallback({
  gmail_status,
}: {
  gmail_status: "success" | "failed" | "error";
}) {
  const queryClient = useQueryClient();
  const router = useRouter();

  useQuery({
    queryKey: ["gmail", "callback", gmail_status],
    queryFn: async () => {
      const status = gmail_status;

      if (status === "success") {
        toast.success("Gmail connected successfully");
        await queryClient.invalidateQueries({
          queryKey: ["gmail", "connections"],
        });
      } else if (status === "failed") {
        toast.error("Gmail connection failed");
      } else if (status === "error") {
        toast.error("An error occurred during connection");
      }

      router.push("/");
    },
  });

  return (
    <div className="flex h-screen items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        <p className="text-muted-foreground text-sm">
          Completing connection...
        </p>
      </div>
    </div>
  );
}

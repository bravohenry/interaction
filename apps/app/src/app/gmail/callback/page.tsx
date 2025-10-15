import { GmailCallback } from "./callback";

export default async function GmailCallbackPage({
  searchParams,
}: {
  searchParams: Promise<{ gmail_status: string }>;
}) {
  const { gmail_status } = await searchParams;

  return (
    <GmailCallback
      gmail_status={gmail_status as "success" | "failed" | "error"}
    />
  );
}

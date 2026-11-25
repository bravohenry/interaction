import { headers } from "next/headers";
import { PanelShell } from "~/components/panel";
import { auth } from "~/server/lib/auth";
import { HydrateClient, prefetch, trpc } from "~/trpc/server";

async function HomePage() {
  // 尝试获取会话，如果失败则继续（可能是数据库连接问题）
  let session = null;
  try {
    session = await auth.api.getSession({
      headers: await headers(),
    });
  } catch (error) {
    // 如果数据库连接失败，记录错误但继续渲染页面
    console.error("Failed to get session:", error);
  }

  // Prefetch Gmail connections to avoid loading skeleton
  if (session?.user) {
    try {
      prefetch(trpc.chat.updates.queryOptions());
      prefetch(trpc.gmail.connections.queryOptions());
    } catch (error) {
      // 如果 prefetch 失败，记录错误但继续渲染
      console.error("Failed to prefetch data:", error);
    }
  }

  return (
    <HydrateClient>
      <PanelShell />
    </HydrateClient>
  );
}

export default HomePage;

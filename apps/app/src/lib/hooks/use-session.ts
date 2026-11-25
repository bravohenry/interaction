"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useSession as useAuthSession } from "~/lib/auth-client";
import { queryKeys } from "~/lib/query-keys";

// Mock session key
const MOCK_SESSION_KEY = "carol_mock_session";

// 获取 mock session 的辅助函数
function getMockSession() {
  if (typeof window === "undefined") return null;
  const stored = localStorage.getItem(MOCK_SESSION_KEY);
  if (!stored) return null;
  try {
    const parsed = JSON.parse(stored);
    // 检查是否过期
    if (parsed.session?.expiresAt && new Date(parsed.session.expiresAt) < new Date()) {
      localStorage.removeItem(MOCK_SESSION_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

/**
 * 自定义 session hook，优先返回 mock session（如果存在）
 * 用于前端演示，跳过实际验证
 */
export function useSession() {
  const { data: realSession, isPending: isRealSessionPending } = useAuthSession();
  const [mockSession, setMockSession] = useState<typeof realSession | null>(null);
  const queryClient = useQueryClient();

  // 检查 mock session
  useEffect(() => {
    const mock = getMockSession();
    setMockSession(mock);
    
    // 监听 localStorage 变化
    const handleStorageChange = () => {
      const updated = getMockSession();
      setMockSession(updated);
      // 同步更新 query cache
      if (updated) {
        queryClient.setQueryData(queryKeys.session, updated);
      } else {
        queryClient.removeQueries({ queryKey: queryKeys.session });
      }
    };
    
    window.addEventListener("storage", handleStorageChange);
    // 也监听同窗口的变化（通过自定义事件）
    window.addEventListener("carol:mock-session-update", handleStorageChange);
    
    return () => {
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener("carol:mock-session-update", handleStorageChange);
    };
  }, [queryClient]);

  // 优先使用 mock session，如果没有则使用真实 session
  const session = mockSession || realSession;
  const isPending = !mockSession && isRealSessionPending;

  return {
    data: session,
    isPending,
  };
}



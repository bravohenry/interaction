"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { BiLogoGoogle } from "react-icons/bi";
import { authClient } from "~/lib/auth-client";
import { queryKeys } from "~/lib/query-keys";

// Mock session for frontend-only demo
const MOCK_SESSION_KEY = "carol_mock_session";

function createMockSession() {
  return {
    user: {
      id: "mock-user-123",
      name: "Demo User",
      email: "demo@carol.health",
      emailVerified: true,
      image: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    session: {
      id: "mock-session-123",
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      token: "mock-token",
      userId: "mock-user-123",
    },
  };
}

export function SignInForm() {
  const queryClient = useQueryClient();

  const signInWithGoogle = async () => {
    // 暂时跳过实际验证，仅做前端效果
    // 创建模拟 session 并存储到 localStorage
    const mockSession = createMockSession();
    localStorage.setItem(MOCK_SESSION_KEY, JSON.stringify(mockSession));
    
    // 更新 query cache 以触发 UI 更新
    queryClient.setQueryData(queryKeys.session, mockSession);
    
    // 触发自定义事件通知其他组件
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("carol:mock-session-update"));
    }
    
    // 模拟延迟以显示加载状态
    await new Promise((resolve) => setTimeout(resolve, 500));
    
    return mockSession;
  };

  const {
    mutate: handleGoogleSignIn,
    isPending,
    error,
  } = useMutation({
    mutationFn: signInWithGoogle,
  });

  return (
    <div>
      {error && (
        <div className="mb-4 rounded-xl bg-destructive/10 p-3 text-destructive text-sm/6">
          {error.message}
        </div>
      )}

      <button
        className="inline-flex h-12 w-full items-center justify-center rounded-full bg-black px-5 font-medium text-base/6 text-white shadow-black/10 shadow-lg transition-colors hover:bg-black/90 focus:outline-hidden focus:ring-3 focus:ring-black focus:ring-offset-2 active:translate-y-px"
        disabled={isPending}
        onClick={() => handleGoogleSignIn()}
        type="button"
      >
        <BiLogoGoogle className="size-5" />
        {isPending ? "Signing in..." : "Continue with Google"}
      </button>
    </div>
  );
}

import { type NextRequest, NextResponse } from "next/server";

export const runtime = "edge";

export async function GET(request: NextRequest) {
  const userAgent = request.headers.get("user-agent");

  if (userAgent !== "vercel-cron/1.0") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const authSecret = process.env.BETTER_AUTH_SECRET;
  if (!authSecret) {
    return NextResponse.json(
      { error: "Missing BETTER_AUTH_SECRET" },
      { status: 500 }
    );
  }

  const backendUrl = process.env.NEXT_PUBLIC_PY_BACKEND_URL;
  if (!backendUrl) {
    return NextResponse.json(
      { error: "Missing NEXT_PUBLIC_PY_BACKEND_URL" },
      { status: 500 }
    );
  }

  try {
    const response = await fetch(`${backendUrl}/api/agents/cleanup`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authSecret}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        { error: "Cleanup failed", details: errorText },
        { status: response.status }
      );
    }

    const result = await response.json();
    return NextResponse.json({
      success: true,
      message: "Agent cleanup completed",
      result,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to call backend cleanup",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

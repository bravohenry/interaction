import { auth } from "~/server/lib/auth";

const PY_API = process.env.NEXT_PUBLIC_PY_BACKEND_URL;

export async function POST(req: Request) {
  try {
    const session = await auth.api.getSession({
      headers: req.headers,
    });

    if (!session?.user?.id) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();

    const resp = await fetch(`${PY_API}/api/v1/gmail/disconnect`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-User-Id": session.user.id,
      },
      body: JSON.stringify({ ...body, user_id: session.user.id }),
    });

    const data = await resp.json();
    return Response.json(data, { status: resp.status });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to disconnect";
    return Response.json({ error: message }, { status: 500 });
  }
}

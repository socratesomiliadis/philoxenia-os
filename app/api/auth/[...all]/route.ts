import { getServerAuth } from "@/lib/auth-server";

function unavailable() {
  return Response.json({ error: "Authentication has not been configured." }, { status: 503 });
}

export async function GET(request: Request) {
  const auth = getServerAuth();
  return auth ? auth.handler.GET(request) : unavailable();
}

export async function POST(request: Request) {
  const auth = getServerAuth();
  return auth ? auth.handler.POST(request) : unavailable();
}

export async function GET() {
  const r = await fetch("http://127.0.0.1:9876/update/check", { cache: "no-store" });
  const json = await r.json();
  return Response.json(json, { status: r.status });
}

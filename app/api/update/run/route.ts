export async function POST() {
  const r = await fetch("http://127.0.0.1:9876/update/run", { method: "POST" });
  const json = await r.json();
  return Response.json(json, { status: r.status });
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q");

  if (!q || q.trim().length < 3) {
    return Response.json([]);
  }

  const res = await fetch(
    `https://nominatim.openstreetmap.org/search?format=json&limit=5&countrycodes=my&q=${encodeURIComponent(q)}`,
    {
      headers: {
        "User-Agent": "FootyHub/1.0 (aidilshaheezam@gmail.com)",
      },
    }
  );

  const data = await res.json();
  return Response.json(data);
}

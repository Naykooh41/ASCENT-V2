// /api/claude — fonction serverless Vercel.
// La clé API vit UNIQUEMENT ici, dans la variable d'environnement ANTHROPIC_API_KEY.
// Format d'appel : { prompt, maxTokens, images: [dataURL, ...] } (ou "image" seul, rétro-compatible).
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST uniquement" });
  if (!process.env.ANTHROPIC_API_KEY) return res.status(500).json({ error: "ANTHROPIC_API_KEY manquante sur Vercel" });
  try {
    const { prompt, maxTokens = 800, images = [], image } = req.body || {};
    const imgs = [...(Array.isArray(images) ? images : []), ...(image ? [image] : [])].slice(0, 4);
    const content = [
      ...imgs.map((d) => {
        const [meta, data] = String(d).split(",");
        const media = (meta && (meta.match(/data:(.*?);/) || [])[1]) || "image/jpeg";
        return { type: "image", source: { type: "base64", media_type: media, data } };
      }),
      { type: "text", text: String(prompt || "") },
    ];
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: Math.max(50, Math.min(1500, Number(maxTokens) || 800)),
        messages: [{ role: "user", content }],
      }),
    });
    const d = await r.json();
    if (!r.ok) return res.status(500).json({ error: (d.error && d.error.message) || "IA indisponible" });
    const text = (d.content || []).map((b) => (b.type === "text" ? b.text : "")).join("");
    return res.status(200).json({ text });
  } catch (e) {
    return res.status(500).json({ error: "IA indisponible" });
  }
}

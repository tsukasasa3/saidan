import Anthropic from "@anthropic-ai/sdk";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const { goods, shelf } = req.body;

  if (!goods?.length) {
    return res.status(400).json({ error: "グッズを追加してください" });
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const goodsList = goods
    .map(g => `・${g.type}（${g.size}cm）× ${g.count}個`)
    .join("\n");

  const shelfText =
    shelf?.width && shelf?.depth && shelf?.height
      ? `棚サイズ: 幅${shelf.width}cm × 奥行き${shelf.depth}cm × 高さ${shelf.height}cm`
      : "棚サイズ: 未指定（一般的な棚を想定）";

  const prompt = `推しグッズの配置のプロとして、以下のグッズを最もかわいく・見映えよく飾るための配置案を提案してください。

${shelfText}

グッズ一覧:
${goodsList}

以下の形式で提案してください：
1. 配置の基本方針（2〜3文）
2. 具体的な配置案（前列・後列・高さ別など、箇条書きで）
3. ワンポイントアドバイス

簡潔に、実用的に、推し活を楽しむ人に向けて答えてください。`;

  try {
    const message = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 800,
      messages: [{ role: "user", content: prompt }],
    });

    res.json({ suggestion: message.content[0].text });
  } catch (e) {
    console.error("[suggest]", e);
    res.status(500).json({ error: "AIの応答に失敗しました" });
  }
}

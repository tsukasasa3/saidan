import Anthropic from "@anthropic-ai/sdk";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const { goods, props = [], risers = [], space, mode = "shelf" } = req.body;

  if (!goods?.length) {
    return res.status(400).json({ error: "グッズを追加してください" });
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const goodsList = goods
    .map(g => `・${g.type}（${g.size}cm）× ${g.count}個`)
    .join("\n");

  const propsList = props.length
    ? "\n小道具:\n" + props.map(p => `・${p.type}${p.note ? `（${p.note}）` : ""}`).join("\n")
    : "";

  const risersList = risers.length
    ? "\n台・スタンド:\n" + risers.map(r => `・高さ${r.height}cm × ${r.count}個`).join("\n")
    : "";

  let prompt;

  if (mode === "flat") {
    const spaceText =
      space?.width && space?.depth
        ? `撮影スペース: 幅${space.width}cm × 奥行き${space.depth}cm`
        : "撮影スペース: 未指定（A3程度を想定）";

    prompt = `推しの誕生日祭壇・平置き撮影のプロとして、以下のアイテムを真上から撮ったときに最もかわいく映える配置案を提案してください。

${spaceText}

グッズ一覧:
${goodsList}${propsList}${risersList}

以下の形式で提案してください：
1. 全体のコンセプト（2〜3文）
2. 具体的な配置案（中央・周囲・余白の使い方、台を使う場合の高低差の活かし方など、箇条書きで）
3. 写真映えのワンポイントアドバイス（背景シート・照明・角度など）

誕生日祭壇や推し活写真を楽しむ人に向けて、実用的に答えてください。`;
  } else {
    const spaceText =
      space?.width && space?.depth && space?.height
        ? `棚サイズ: 幅${space.width}cm × 奥行き${space.depth}cm × 高さ${space.height}cm`
        : "棚サイズ: 未指定（一般的な棚を想定）";

    prompt = `推しグッズの配置のプロとして、以下のアイテムを最もかわいく・見映えよく飾るための配置案を提案してください。

${spaceText}

グッズ一覧:
${goodsList}${propsList}${risersList}

以下の形式で提案してください：
1. 配置の基本方針（2〜3文）
2. 具体的な配置案（前列・後列・高さ別、台を使う場合の高低差の活かし方など、箇条書きで）
3. ワンポイントアドバイス

簡潔に、実用的に、推し活を楽しむ人に向けて答えてください。`;
  }

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

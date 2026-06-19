import Stripe from "stripe";

// JWTのペイロードをデコードしてsubを取得（署名検証なし）
function userIdFromJwt(token) {
  try {
    const part = token.split(".")[1];
    const b64 = part.replace(/-/g, "+").replace(/_/g, "/");
    const padded = b64 + "=".repeat((4 - b64.length % 4) % 4);
    const payload = JSON.parse(Buffer.from(padded, "base64").toString("utf8"));
    return payload?.sub || null;
  } catch { return null; }
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const { materialId, materialName, price, userId, accessToken } = req.body;

  // userIdの解決: クライアントから来た値 → JWTデコード の順で試みる
  let resolvedUserId = userId || null;
  if (!resolvedUserId && accessToken) {
    resolvedUserId = userIdFromJwt(accessToken);
    console.log("[checkout] resolved userId from JWT:", resolvedUserId);
  }

  if (!materialId || !price || !resolvedUserId) {
    console.error("[checkout] Missing fields:", { materialId, price, resolvedUserId, hasAccessToken: !!accessToken });
    return res.status(400).json({ error: "Missing required fields" });
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const origin = req.headers.origin || "https://saidan-black.vercel.app";

  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "jpy",
            product_data: {
              name: materialName || "SAIDAN素材",
              description: "SAIDANクリエイター素材",
            },
            unit_amount: price,
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      metadata: { materialId, userId: resolvedUserId },
      success_url: `${origin}/?payment_success=${materialId}`,
      cancel_url:  `${origin}/?page=market`,
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error("Stripe error:", err);
    res.status(500).json({ error: err.message });
  }
}

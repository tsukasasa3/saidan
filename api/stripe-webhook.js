import Stripe from "stripe";

// Vercelのbody自動パースを無効化（Stripe署名検証に生のbodyが必要）
export const config = { api: { bodyParser: false } };

const SUPABASE_URL = "https://gwkkyoqgcahyzasngaje.supabase.co";

async function sbAdmin(path, options = {}) {
  const res = await fetch(SUPABASE_URL + path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "apikey":        process.env.SUPABASE_SERVICE_ROLE_KEY,
      "Authorization": `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      ...options.headers,
    },
  });
  const text = await res.text();
  const json = text ? JSON.parse(text) : null;
  if (!res.ok) {
    throw new Error(`Supabase ${res.status}: ${text}`);
  }
  return json;
}

async function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", c => chunks.push(c));
    req.on("end",  () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const stripe    = new Stripe(process.env.STRIPE_SECRET_KEY);
  const rawBody   = await getRawBody(req);
  const sig       = req.headers["stripe-signature"];

  let event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error("Webhook signature error:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === "checkout.session.completed") {
    const session    = event.data.object;
    const materialId = session.metadata?.materialId;
    const userId     = session.metadata?.userId;
    const amountPaid = session.amount_total; // JPY整数

    // 支払いが完了していない場合はスキップ（unpaid / no_payment_required以外は無視）
    if (session.payment_status !== "paid") {
      console.log(`Skipping session with payment_status=${session.payment_status}`);
      return res.json({ received: true });
    }

    if (!materialId || !userId) {
      console.error("Missing metadata:", session.metadata);
      return res.json({ received: true });
    }

    // Webhookの再送による二重記録を防ぐ（payment_intentで重複チェック）
    // SELECTが権限エラーになっても無視してINSERTを続行する
    if (session.payment_intent) {
      try {
        const existing = await sbAdmin(
          `/rest/v1/purchases?stripe_payment_intent=eq.${session.payment_intent}&select=id`
        );
        if (existing?.length > 0) {
          console.log(`Duplicate webhook ignored: payment_intent=${session.payment_intent}`);
          return res.json({ received: true });
        }
      } catch (e) {
        console.log("Dedup check skipped (will attempt insert):", e.message);
      }
    }

    try {
      // 購入履歴を記録
      const purchase = await sbAdmin("/rest/v1/purchases", {
        method:  "POST",
        headers: { "Prefer": "return=representation" },
        body: JSON.stringify({
          user_id:                userId,
          material_id:            materialId,
          amount_paid:            amountPaid,
          stripe_payment_intent:  session.payment_intent,
        }),
      });

      // クリエイターの売上を記録（80%）
      const materials = await sbAdmin(
        `/rest/v1/creator_materials?id=eq.${materialId}&select=creator_id`
      );
      const creatorId = materials?.[0]?.creator_id;

      if (creatorId && purchase?.[0]?.id) {
        await sbAdmin("/rest/v1/creator_earnings", {
          method:  "POST",
          headers: { "Prefer": "return=minimal" },
          body: JSON.stringify({
            creator_id:  creatorId,
            purchase_id: purchase[0].id,
            amount:      Math.floor(amountPaid * 0.8),
            status:      "pending",
          }),
        });
      }

      console.log(`Purchase recorded: user=${userId} material=${materialId} amount=${amountPaid}`);
    } catch (err) {
      console.error("DB error:", err);
    }
  }

  res.json({ received: true });
}

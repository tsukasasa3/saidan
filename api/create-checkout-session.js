import Stripe from "stripe";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const { materialId, materialName, price, userId } = req.body;
  if (!materialId || !price || !userId) {
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
            unit_amount: price, // JPYは整数（cents不要）
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      metadata: { materialId, userId },
      success_url: `${origin}/?payment_success=${materialId}`,
      cancel_url:  `${origin}/?page=market`,
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error("Stripe error:", err);
    res.status(500).json({ error: err.message });
  }
}

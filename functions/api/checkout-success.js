export async function onRequestGet(context) {
  try {
    const url = new URL(context.request.url);
    const sessionId = url.searchParams.get("session_id");

    if (!sessionId) {
      return Response.json(
        { error: "Missing Stripe session ID." },
        { status: 400 }
      );
    }

    const stripeKey = context.env.STRIPE_SECRET_KEY;

    if (!stripeKey) {
      return Response.json(
        { error: "Stripe secret key is missing." },
        { status: 500 }
      );
    }

    if (!context.env.DB) {
      return Response.json(
        { error: "Database binding is missing." },
        { status: 500 }
      );
    }

    // Get the completed Checkout Session directly from Stripe
    const stripeResponse = await fetch(
      "https://api.stripe.com/v1/checkout/sessions/" +
        encodeURIComponent(sessionId),
      {
        headers: {
          Authorization: "Bearer " + stripeKey
        }
      }
    );

    const session = await stripeResponse.json();

    if (!stripeResponse.ok) {
      return Response.json(
        {
          error:
            session?.error?.message ||
            "Could not verify payment with Stripe."
        },
        { status: 500 }
      );
    }

    // Only save a donation after Stripe confirms it was paid
    if (session.payment_status !== "paid") {
      return Response.json(
        { error: "Payment has not been completed." },
        { status: 400 }
      );
    }

    const playerKey =
      session.metadata?.player_key || "";

    const playerName =
      session.metadata?.player || "";

    const donorName =
      session.metadata?.donor_name || "";

    const anonymous =
      session.metadata?.anonymous === "yes" ? 1 : 0;

    const baseballs =
      session.metadata?.baseballs || "";

    const donorEmail =
      session.customer_details?.email ||
      session.customer_email ||
      "";

    // Stripe amount_total is in cents.
    const amount =
      Number(session.amount_total || 0) / 100;

    await context.env.DB
      .prepare(`
        INSERT OR IGNORE INTO donations
        (
          stripe_session_id,
          player_key,
          player_name,
          amount,
          baseballs,
          donor_name,
          donor_email,
          anonymous
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .bind(
        session.id,
        playerKey,
        playerName,
        amount,
        baseballs,
        donorName,
        donorEmail,
        anonymous
      )
      .run();

    return Response.json({
      success: true,
      amount: amount,
      playerKey: playerKey,
      playerName: playerName
    });

  } catch (error) {
    console.error("Checkout success error:", error);

    return Response.json(
      { error: "Could not record donation." },
      { status: 500 }
    );
  }
}

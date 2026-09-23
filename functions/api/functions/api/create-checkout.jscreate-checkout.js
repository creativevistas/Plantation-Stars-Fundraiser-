export async function onRequestPost(context) {
  try {
    const body = await context.request.json();

    const amount = Number(body.amount);

    if (!amount || amount < 1) {
      return Response.json(
        { error: "Invalid donation amount." },
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

    const origin = new URL(context.request.url).origin;

    const params = new URLSearchParams();

    params.append("mode", "payment");
    params.append("success_url", origin + "/?donation=success");
    params.append("cancel_url", context.request.headers.get("Referer") || origin);

    params.append("line_items[0][price_data][currency]", "usd");
    params.append(
      "line_items[0][price_data][product_data][name]",
      "Plantation Stars Red — Cooperstown Fundraiser"
    );
    params.append(
      "line_items[0][price_data][unit_amount]",
      String(Math.round(amount * 100))
    );
    params.append("line_items[0][quantity]", "1");

    if (body.donorEmail) {
      params.append("customer_email", body.donorEmail);
    }

    if (body.player) {
      params.append("metadata[player]", body.player);
    }

    if (body.playerKey) {
      params.append("metadata[player_key]", body.playerKey);
    }

    if (body.donorName) {
      params.append("metadata[donor_name]", body.donorName);
    }

    params.append(
      "metadata[anonymous]",
      body.anonymous ? "yes" : "no"
    );

    if (Array.isArray(body.baseballs)) {
      params.append(
        "metadata[baseballs]",
        body.baseballs.join(", ")
      );
    }

    const stripeResponse = await fetch(
      "https://api.stripe.com/v1/checkout/sessions",
      {
        method: "POST",
        headers: {
          Authorization: "Bearer " + stripeKey,
          "Content-Type": "application/x-www-form-urlencoded"
        },
        body: params
      }
    );

    const session = await stripeResponse.json();

    if (!stripeResponse.ok) {
      console.error("Stripe error:", session);

      return Response.json(
        {
          error:
            session?.error?.message ||
            "Stripe could not create checkout."
        },
        { status: 500 }
      );
    }

    return Response.json({ url: session.url });

  } catch (error) {
    console.error(error);

    return Response.json(
      { error: "Checkout could not be created." },
      { status: 500 }
    );
  }
}

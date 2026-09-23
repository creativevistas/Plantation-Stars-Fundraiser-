export async function onRequestPost(context) {
  try {
    const { request, env } = context;
    const body = await request.json();

    const amount = Number(body.amount);

    if (!amount || amount < 1) {
      return new Response(
        JSON.stringify({ error: "Invalid donation amount" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" }
        }
      );
    }

    const params = new URLSearchParams();

    params.append("mode", "payment");
    params.append("success_url", `${new URL(request.url).origin}/?success=true`);
    params.append("cancel_url", `${new URL(request.url).origin}/`);

    params.append("line_items[0][price_data][currency]", "usd");
    params.append(
      "line_items[0][price_data][unit_amount]",
      Math.round(amount * 100).toString()
    );
    params.append(
      "line_items[0][price_data][product_data][name]",
      "Plantation Stars Red – Cooperstown Fundraiser"
    );
    params.append("line_items[0][quantity]", "1");

    const stripeResponse = await fetch(
      "https://api.stripe.com/v1/checkout/sessions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
          "Content-Type": "application/x-www-form-urlencoded"
        },
        body: params
      }
    );

    const session = await stripeResponse.json();

    if (!stripeResponse.ok) {
      return new Response(JSON.stringify(session), {
        status: stripeResponse.status,
        headers: { "Content-Type": "application/json" }
      });
    }

    return new Response(
      JSON.stringify({ url: session.url }),
      {
        headers: { "Content-Type": "application/json" }
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" }
      }
    );
  }
}

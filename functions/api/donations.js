export async function onRequestGet(context) {
  try {
    const url = new URL(context.request.url);
    const playerKey = url.searchParams.get("player");

    if (!context.env.DB) {
      return Response.json(
        { error: "Database binding is missing." },
        { status: 500 }
      );
    }

    if (!playerKey) {
      return Response.json(
        { error: "Player is required." },
        { status: 400 }
      );
    }

    const result = await context.env.DB
      .prepare(`
        SELECT
          COALESCE(SUM(amount), 0) AS total,
          COUNT(*) AS donation_count
        FROM donations
        WHERE player_key = ?
      `)
      .bind(playerKey)
      .first();

    return Response.json({
      success: true,
      playerKey: playerKey,
      total: Number(result?.total || 0),
      donationCount: Number(result?.donation_count || 0)
    });

  } catch (error) {
    console.error("Donations API error:", error);

    return Response.json(
      { error: "Could not load donations." },
      { status: 500 }
    );
  }
}

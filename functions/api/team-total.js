export async function onRequestGet(context) {
  try {
    if (!context.env.DB) {
      return Response.json(
        { error: "Database binding is missing." },
        { status: 500 }
      );
    }

    const result = await context.env.DB
      .prepare(`
        SELECT
          COALESCE(SUM(amount), 0) AS total,
          COUNT(*) AS donation_count
        FROM donations
      `)
      .first();

    return Response.json({
      success: true,
      total: Number(result?.total || 0),
      donationCount: Number(result?.donation_count || 0)
    });

  } catch (error) {
    console.error("Team total API error:", error);

    return Response.json(
      { error: "Could not load team total." },
      { status: 500 }
    );
  }
}

// Placeholder Netlify Function for /api/render/:jobId
export default async (req) => {
  return new Response(JSON.stringify({ status: "failed", error: "Not wired yet." }), {
    status: 501,
    headers: { "content-type": "application/json" },
  });
};
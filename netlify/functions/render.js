// Placeholder Netlify Function for /api/render (Option B)
// This file is a scaffold. We'll replace it with the real implementation
// (Replicate or Runpod) once you pick the GPU provider.
//
// NOTE: Netlify routes functions at /.netlify/functions/<name> by default.
// We'll add redirects so it behaves like /api/render.
export default async (req) => {
  return new Response(JSON.stringify({ error: "Not wired yet. Choose Replicate or Runpod." }), {
    status: 501,
    headers: { "content-type": "application/json" },
  });
};
// Serves quaedra.com/nodd/app/*. Static assets are matched first; this only runs on a miss.
// Workers assets cap files at 25 MiB, so scripts/deploy.sh splits larger files into
// `<file>.part<N>` chunks plus `<file>.parts.json`; reassemble them here as one response.
const ISOLATION = {
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Embedder-Policy": "require-corp",
  "Cross-Origin-Resource-Policy": "same-origin",
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method !== "GET" && request.method !== "HEAD") return env.ASSETS.fetch(request);
    const manifest = await env.ASSETS.fetch(new URL(url.pathname + ".parts.json", url));
    if (!manifest.ok) return env.ASSETS.fetch(request);
    const { parts, size, type } = await manifest.json();
    const headers = { "Content-Type": type, "Content-Length": String(size), "Cache-Control": "public, max-age=3600", ...ISOLATION };
    if (request.method === "HEAD") return new Response(null, { headers });
    const { readable, writable } = new FixedLengthStream(size);
    (async () => {
      for (let i = 0; i < parts; i++) {
        const res = await env.ASSETS.fetch(new URL(`${url.pathname}.part${i}`, url));
        if (!res.ok) throw new Error(`missing part ${i} of ${url.pathname}`);
        await res.body.pipeTo(writable, { preventClose: i < parts - 1 });
      }
    })().catch((err) => writable.abort(err));
    return new Response(readable, { headers });
  },
};

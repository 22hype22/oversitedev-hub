// Static server for the built dashboard on Railway.
//
// Two things `serve -s dist` could not do:
//   1. Send anyone who arrives over plain http to the https address, so the
//      browser never shows the page as "Not secure".
//   2. Send a Strict-Transport-Security header, so after one https visit the
//      browser goes straight to https on its own next time.
// Everything else matches the old command: serve dist with the history-API
// fallback so client-side routes resolve to index.html.
import http from "node:http";
import handler from "serve-handler";

const PORT = Number(process.env.PORT || 8080);
const ROOT = new URL("./dist", import.meta.url).pathname;
const ONE_YEAR = 60 * 60 * 24 * 365;

const server = http.createServer(async (req, res) => {
  // Railway terminates TLS at its edge and tells us the original scheme here.
  const proto = String(req.headers["x-forwarded-proto"] || "").split(",")[0].trim();
  const host = String(req.headers["x-forwarded-host"] || req.headers.host || "").split(",")[0].trim();
  if (proto === "http" && host && !host.startsWith("localhost") && !host.startsWith("127.")) {
    res.writeHead(301, { Location: `https://${host}${req.url ?? "/"}` });
    res.end();
    return;
  }
  res.setHeader("Strict-Transport-Security", `max-age=${ONE_YEAR}; includeSubDomains`);
  await handler(req, res, {
    public: ROOT,
    // Same behaviour as `serve -s`: unknown paths fall back to the SPA shell.
    rewrites: [{ source: "**", destination: "/index.html" }],
    headers: [
      { source: "assets/**", headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }] },
      { source: "index.html", headers: [{ key: "Cache-Control", value: "no-cache" }] },
    ],
  });
});

server.listen(PORT, () => {
  console.log(`dashboard listening on ${PORT}`);
});

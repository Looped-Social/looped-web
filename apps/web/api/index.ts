import { createRequestListener } from "@react-router/node";
import { createRequestListener as createFetchRequestListener } from "@mjackson/node-fetch-server";
import crypto from "node:crypto";
import fs from "node:fs";
import type { IncomingMessage, ServerResponse } from "node:http";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

type NodeHandler = (req: IncomingMessage, res: ServerResponse) => void;

type ServerState = {
  handler: NodeHandler;
  assetsDir: string;
  publicPath: string;
};

const projectRoot = process.cwd();
const moduleDir = path.dirname(fileURLToPath(import.meta.url));

const resolveFirstExisting = (candidates: string[]) => {
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  return candidates[0];
};

const buildPath = resolveFirstExisting([
  path.resolve(projectRoot, "build/server/index.js"),
  path.resolve(moduleDir, "../build/server/index.js"),
  path.resolve(moduleDir, "../../build/server/index.js"),
]);

const publicDir = resolveFirstExisting([
  path.resolve(projectRoot, "public"),
  path.resolve(moduleDir, "../public"),
  path.resolve(moduleDir, "../../public"),
]);
const gateHash = process.env.WEB_GATE_SHA256 ?? "";
const gateCookieName = "looped-web-gate";

const gatePageHtml = (options?: { error?: string }) => {
  const errorMarkup = options?.error
    ? `<p style="margin:16px 0 0;color:#dc2626;font-size:14px">${options.error}</p>`
    : "";

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="robots" content="noindex,nofollow" />
    <title>Looped</title>
    <style>
      :root { color-scheme: light dark; }
      body { margin:0; font-family: ui-sans-serif, system-ui, -apple-system, sans-serif; background:#0b0b0f; color:#f8fafc; }
      .wrap { min-height:100vh; display:flex; align-items:center; justify-content:center; padding:24px; }
      .card { width:min(440px, 100%); background:#111827; border:1px solid rgba(255,255,255,0.12); border-radius:16px; padding:28px; box-shadow:0 24px 48px rgba(15,23,42,0.2); }
      h1 { margin:0 0 8px; font-size:22px; letter-spacing:-0.01em; }
      p { margin:0 0 20px; color:#cbd5f5; }
      label { display:block; font-size:14px; margin-bottom:6px; color:#e2e8f0; }
      input { width:100%; padding:12px 14px; border-radius:10px; border:1px solid rgba(255,255,255,0.18); background:#0f172a; color:#f8fafc; font-size:15px; }
      button { margin-top:16px; width:100%; padding:12px 14px; border-radius:10px; border:none; background:#ea404a; color:white; font-weight:600; cursor:pointer; }
      button:hover { filter:brightness(0.95); }
    </style>
  </head>
  <body>
    <div class="wrap">
      <div class="card">
        <h1>Private Access</h1>
        <p>Enter the password to continue.</p>
        <form method="POST" action="/__gate">
          <label for="password">Password</label>
          <input id="password" name="password" type="password" autocomplete="current-password" required />
          <button type="submit">Enter</button>
        </form>
        ${errorMarkup}
      </div>
    </div>
  </body>
</html>`;
};

const mimeTypes: Record<string, string> = {
  ".css": "text/css",
  ".gif": "image/gif",
  ".ico": "image/x-icon",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "text/javascript",
  ".json": "application/json",
  ".map": "application/json",
  ".mjs": "text/javascript",
  ".mp4": "video/mp4",
  ".otf": "font/otf",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ttf": "font/ttf",
  ".txt": "text/plain",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

let cached: ServerState | null = null;

function parseCookies(header: string | undefined) {
  const cookies: Record<string, string> = {};
  if (!header) {
    return cookies;
  }
  header.split(";").forEach((part) => {
    const [name, ...rest] = part.trim().split("=");
    if (!name) {
      return;
    }
    cookies[name] = decodeURIComponent(rest.join("="));
  });
  return cookies;
}

function isAuthed(req: IncomingMessage) {
  if (!gateHash) {
    return true;
  }
  const cookies = parseCookies(req.headers.cookie);
  return cookies[gateCookieName] === "1";
}

function buildSetCookieHeader(req: IncomingMessage) {
  const secure =
    (req.headers["x-forwarded-proto"] ?? "").toString() === "https" ||
    process.env.NODE_ENV === "production";
  const parts = [
    `${gateCookieName}=1`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    "Max-Age=604800",
  ];
  if (secure) {
    parts.push("Secure");
  }
  return parts.join("; ");
}

async function readBody(req: IncomingMessage) {
  return new Promise<string>((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

async function getServerState(): Promise<ServerState> {
  if (cached) {
    return cached;
  }

  const buildModule = await import(pathToFileURL(buildPath).href);
  let assetsDir = path.resolve(process.cwd(), "build/client");
  let publicPath = "/";
  let handler: NodeHandler;

  if (buildModule.default && typeof buildModule.default === "function") {
    const config = {
      publicPath: "/",
      assetsBuildDirectory: "../client",
      ...(buildModule.unstable_reactRouterServeConfig ?? {}),
    };

    publicPath = config.publicPath ?? "/";
    assetsDir = path.resolve(path.dirname(buildPath), config.assetsBuildDirectory);
    handler = createFetchRequestListener(buildModule.default);
  } else {
    const build = buildModule;
    publicPath = build.publicPath ?? "/";
    if (build.assetsBuildDirectory) {
      assetsDir = path.isAbsolute(build.assetsBuildDirectory)
        ? build.assetsBuildDirectory
        : path.resolve(path.dirname(buildPath), build.assetsBuildDirectory);
    }
    handler = createRequestListener({ build, mode: process.env.NODE_ENV });
  }

  cached = { handler, assetsDir, publicPath };
  return cached;
}

function normalizePublicPath(value: string) {
  if (!value.startsWith("/")) {
    return `/${value}`;
  }
  return value.endsWith("/") ? value : `${value}/`;
}

function toSafePath(baseDir: string, relativePath: string) {
  const resolvedBase = path.resolve(baseDir);
  const resolvedPath = path.resolve(resolvedBase, relativePath);
  if (!resolvedPath.startsWith(resolvedBase + path.sep)) {
    return null;
  }
  return resolvedPath;
}

async function serveStaticFile(
  req: IncomingMessage,
  res: ServerResponse,
  assetsDir: string,
  publicPath: string,
) {
  const method = req.method ?? "GET";
  if (method !== "GET" && method !== "HEAD") {
    return false;
  }

  const host = req.headers.host ?? "localhost";
  const url = new URL(req.url ?? "/", `http://${host}`);
  let pathname = decodeURIComponent(url.pathname);

  if (pathname === "/" || pathname.endsWith("/")) {
    return false;
  }

  const normalizedPublicPath = normalizePublicPath(publicPath);
  if (normalizedPublicPath !== "/" && pathname.startsWith(normalizedPublicPath)) {
    pathname = `/${pathname.slice(normalizedPublicPath.length)}`;
  }

  const relativePath = pathname.replace(/^\/+/, "");
  if (!relativePath) {
    return false;
  }

  const candidates = [
    { base: assetsDir, cacheAssets: relativePath.startsWith("assets/") },
    { base: publicDir, cacheAssets: false },
  ];

  for (const candidate of candidates) {
    const filePath = toSafePath(candidate.base, relativePath);
    if (!filePath) {
      continue;
    }

    let stat: fs.Stats | null = null;
    try {
      stat = await fs.promises.stat(filePath);
    } catch {
      stat = null;
    }

    if (!stat?.isFile()) {
      continue;
    }

    const ext = path.extname(filePath).toLowerCase();
    const mimeType = mimeTypes[ext] ?? "application/octet-stream";
    const cacheControl = candidate.cacheAssets
      ? "public, max-age=31536000, immutable"
      : "public, max-age=3600";

    res.statusCode = 200;
    res.setHeader("Content-Type", mimeType);
    res.setHeader("Cache-Control", cacheControl);

    if (method === "HEAD") {
      res.end();
      return true;
    }

    fs.createReadStream(filePath).pipe(res);
    return true;
  }

  return false;
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if (!isAuthed(req)) {
    if (req.method === "POST" && req.url?.startsWith("/__gate")) {
      const body = await readBody(req);
      const params = new URLSearchParams(body);
      const password = params.get("password") ?? "";
      const hash = crypto.createHash("sha256").update(password).digest("base64");

      if (hash && hash === gateHash) {
        res.statusCode = 303;
        res.setHeader("Set-Cookie", buildSetCookieHeader(req));
        res.setHeader("Location", "/");
        res.end();
        return;
      }

      res.statusCode = 401;
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.end(gatePageHtml({ error: "Incorrect password." }));
      return;
    }

    res.statusCode = 200;
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.end(gatePageHtml());
    return;
  }

  const { handler: routerHandler, assetsDir, publicPath } =
    await getServerState();

  if (await serveStaticFile(req, res, assetsDir, publicPath)) {
    return;
  }

  return routerHandler(req, res);
}

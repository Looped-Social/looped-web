import { createRequestListener } from "@react-router/node";
import { createRequestListener as createFetchRequestListener } from "@mjackson/node-fetch-server";
import fs from "node:fs";
import type { IncomingMessage, ServerResponse } from "node:http";
import path from "node:path";
import { pathToFileURL } from "node:url";

type NodeHandler = (req: IncomingMessage, res: ServerResponse) => void;

type ServerState = {
  handler: NodeHandler;
  assetsDir: string;
  publicPath: string;
};

const buildPath = path.resolve(process.cwd(), "build/server/index.js");
const publicDir = path.resolve(process.cwd(), "public");

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
    assetsDir = build.assetsBuildDirectory ?? assetsDir;
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
  const { handler: routerHandler, assetsDir, publicPath } =
    await getServerState();

  if (await serveStaticFile(req, res, assetsDir, publicPath)) {
    return;
  }

  return routerHandler(req, res);
}

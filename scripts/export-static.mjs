#!/usr/bin/env node
// Turns the Node server build into a fully static site for hosts with no
// Node support (e.g. Hostalia): boots the just-built server on a scratch
// port, fetches each route for real, and writes the rendered HTML next to
// the client assets in .output/public/. Run after `vite build`.
import { spawn } from "node:child_process";
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

const ROUTES = ["/", "/auth"];
const PORT = 4173 + Math.floor(Math.random() * 1000);
const OUT_DIR = path.resolve(".output/public");
const SERVER_ENTRY = path.resolve(".output/server/index.mjs");

function startServer() {
  const server = spawn(process.execPath, [SERVER_ENTRY], {
    env: { ...process.env, PORT: String(PORT) },
    stdio: ["ignore", "pipe", "pipe"],
  });

  const ready = new Promise((resolve, reject) => {
    const onOutput = (chunk) => {
      if (chunk.toString().includes("Listening")) {
        cleanup();
        resolve();
      }
    };
    const onExit = (code) => {
      cleanup();
      reject(new Error(`Server exited before it was ready (code ${code})`));
    };
    const cleanup = () => {
      server.stdout.off("data", onOutput);
      server.stderr.off("data", onOutput);
      server.off("exit", onExit);
    };
    server.stdout.on("data", onOutput);
    server.stderr.on("data", onOutput);
    server.on("exit", onExit);
    setTimeout(() => {
      cleanup();
      reject(new Error("Server did not start within 15s"));
    }, 15000);
  });

  return { server, ready };
}

async function exportRoute(route) {
  const res = await fetch(`http://localhost:${PORT}${route}`);
  if (!res.ok) throw new Error(`Failed to fetch ${route}: HTTP ${res.status}`);
  const html = await res.text();
  const dir = route === "/" ? OUT_DIR : path.join(OUT_DIR, route);
  await mkdir(dir, { recursive: true });
  const file = path.join(dir, "index.html");
  await writeFile(file, html, "utf8");
  console.log(`[export-static] wrote ${path.relative(process.cwd(), file)}`);
}

const { server, ready } = startServer();
try {
  await ready;
  for (const route of ROUTES) await exportRoute(route);
} finally {
  server.kill();
}

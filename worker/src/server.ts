import { promises as fsPromises } from "node:fs"
import http from "node:http"
import path from "node:path"

import { log } from "./log"

/**
 * Starts a simple HTTP server to serve static files from a given directory.
 * @param serveDir The absolute path to the directory containing static files.
 * @returns A promise that resolves with the server instance and the port it's listening on.
 */
export async function startStaticServer(serveDir: string): Promise<{
  server: http.Server
  port: number
}> {
  log.debug(`Starting static server for directory: ${serveDir}`)

  const server = http.createServer((req, res) => {
    // Reject requests that try to access files outside of the served directory
    const requestedPath = path.normalize(req.url?.split("?")[0] ?? "")
    if (requestedPath.includes("..") || !requestedPath.startsWith("/")) {
      log.warn(`Forbidden request: ${req.url}`)
      res.writeHead(403)
      res.end()
      return
    }

    const filePath = path.join(serveDir, requestedPath)
    log.trace(`Serving file request: ${filePath}`)

    fsPromises
      .readFile(filePath)
      .then((content) => {
        const ext = path.extname(filePath)
        const contentType =
          {
            ".html": "text/html",
            ".js": "text/javascript",
            ".css": "text/css",
            ".json": "application/json",
            ".png": "image/png",
            ".jpg": "image/jpeg",
            ".gif": "image/gif",
            ".svg": "image/svg+xml",
          }[ext] ?? "application/octet-stream"

        res.writeHead(200, { "Content-Type": contentType })
        res.end(content)
        log.trace(`Successfully served file: ${filePath}`)
      })
      .catch((err: unknown) => {
        if ((err as { code?: string }).code === "ENOENT") {
          log.warn(`File not found: ${filePath}`)
          res.writeHead(404)
        } else {
          log.error(err, `Error reading file: ${filePath}`)
          res.writeHead(500)
        }
        res.end()
      })
  })

  // Let the OS choose an available port (0)
  server.listen(0)

  // Wait for the server to be ready
  await new Promise<void>((resolve, reject) => {
    server.once("listening", resolve)
    server.once("error", reject)
  })

  const address = server.address()
  if (!address || typeof address === "string") {
    server.close() // Clean up if we failed to get address
    throw new Error("Failed to get server address or port after starting")
  }
  const port = address.port
  log.info(`Static server started on http://localhost:${port}`)

  return { server, port }
}

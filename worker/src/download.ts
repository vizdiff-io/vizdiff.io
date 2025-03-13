import fs from "node:fs"
import { Readable } from "node:stream"

export async function downloadWithTimeout(
  readable: Readable,
  destPath: string,
  timeoutMs: number,
): Promise<void> {
  const writeStream = fs.createWriteStream(destPath)
  const cleanup = () => {
    readable.destroy()
    writeStream.destroy()
  }

  await Promise.race([
    new Promise<void>((resolve, reject) => {
      const stream = readable.pipe(writeStream)
      stream.on("finish", () => resolve())
      stream.on("error", (err: Error) => {
        cleanup()
        reject(err)
      })
    }),
    new Promise<never>((_, reject) => {
      setTimeout(() => {
        cleanup()
        reject(new Error(`Download timed out after ${timeoutMs}ms`))
      }, timeoutMs)
    }),
  ])
}

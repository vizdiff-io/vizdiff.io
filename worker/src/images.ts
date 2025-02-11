import pixelmatch from "pixelmatch"
import { PNG } from "pngjs"

export function diffImages(
  newImage: PNG,
  baselineImage: PNG,
): { diffRatio: number; diffMask: PNG } {
  const diffPng = new PNG({ width: newImage.width, height: newImage.height })
  const numDiffPixels = pixelmatch(
    newImage.data,
    baselineImage.data,
    diffPng.data,
    newImage.width,
    newImage.height,
    {
      // Matching threshold, ranges from 0 to 1. Smaller values make the comparison more
      // sensitive. 0.1 by default.
      threshold: 0.1,
      // The color of differing pixels in the diff output in [R, G, B] format. [255, 0, 0]
      // by default.
      diffColor: [255, 255, 255],
      // Draw the diff over a transparent background (a mask), rather than over the original
      // image. Will not draw anti-aliased pixels (if detected).
      diffMask: true,
    },
  )
  const diffRatio = numDiffPixels / (newImage.width * newImage.height)

  return { diffRatio, diffMask: diffPng }
}

import { PNG } from "pngjs"
import { expect, describe, it } from "vitest"

import { diffImages } from "./images"

describe("diffImages", () => {
  it("should return 0 diffRatio for identical images", () => {
    // Create two identical 2x2 black images
    const image1 = new PNG({ width: 2, height: 2 })
    const image2 = new PNG({ width: 2, height: 2 })
    // Each pixel is 4 bytes (RGBA)
    image1.data = Buffer.from([0, 0, 0, 255, 0, 0, 0, 255, 0, 0, 0, 255, 0, 0, 0, 255])
    image2.data = Buffer.from([0, 0, 0, 255, 0, 0, 0, 255, 0, 0, 0, 255, 0, 0, 0, 255])

    const { diffRatio, diffMask } = diffImages(image1, image2)

    expect(diffRatio).toBe(0)
    expect(diffMask.width).toBe(2)
    expect(diffMask.height).toBe(2)
    // Verify diffMask is all transparent black (no differences)
    expect(Array.from(diffMask.data)).toEqual([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0])
  })

  it("should return 1.0 diffRatio for completely different images", () => {
    // Create a black image and a white image
    const image1 = new PNG({ width: 2, height: 2 })
    const image2 = new PNG({ width: 2, height: 2 })
    // Black image
    image1.data = Buffer.from([0, 0, 0, 255, 0, 0, 0, 255, 0, 0, 0, 255, 0, 0, 0, 255])
    // White image
    image2.data = Buffer.from([
      255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255,
    ])

    const { diffRatio, diffMask } = diffImages(image1, image2)

    expect(diffRatio).toBe(1)
    expect(diffMask.width).toBe(2)
    expect(diffMask.height).toBe(2)
    // Verify diffMask is all white (all pixels different)
    expect(Array.from(diffMask.data)).toEqual([
      255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255,
    ])
  })

  it("should return 0.5 diffRatio for half-different images", () => {
    // Create two images where half the pixels are different
    const image1 = new PNG({ width: 2, height: 2 })
    const image2 = new PNG({ width: 2, height: 2 })
    // Black image
    image1.data = Buffer.from([0, 0, 0, 255, 0, 0, 0, 255, 0, 0, 0, 255, 0, 0, 0, 255])
    // Half black, half white image
    image2.data = Buffer.from([0, 0, 0, 255, 0, 0, 0, 255, 255, 255, 255, 255, 255, 255, 255, 255])

    const { diffRatio, diffMask } = diffImages(image1, image2)

    expect(diffRatio).toBe(0.5)
    expect(diffMask.width).toBe(2)
    expect(diffMask.height).toBe(2)
    // Verify diffMask shows differences only in the bottom half (top half transparent, bottom half white)
    expect(Array.from(diffMask.data)).toEqual([
      0, 0, 0, 0, 0, 0, 0, 0, 255, 255, 255, 255, 255, 255, 255, 255,
    ])
  })

  it("should handle images with transparency", () => {
    // Create two images with different alpha values
    const image1 = new PNG({ width: 2, height: 1 })
    const image2 = new PNG({ width: 2, height: 1 })
    // Semi-transparent black pixels
    image1.data = Buffer.from([0, 0, 0, 128, 0, 0, 0, 128])
    // Fully opaque black pixels
    image2.data = Buffer.from([0, 0, 0, 255, 0, 0, 0, 255])

    const { diffRatio, diffMask } = diffImages(image1, image2)

    expect(diffRatio).toBe(1)
    expect(diffMask.width).toBe(2)
    expect(diffMask.height).toBe(1)
    // Verify diffMask shows differences due to alpha changes
    expect(Array.from(diffMask.data)).toEqual([255, 255, 255, 255, 255, 255, 255, 255])
  })
})

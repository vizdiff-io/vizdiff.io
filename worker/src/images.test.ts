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

  it("should handle mismatched heights (new image taller)", () => {
    // Baseline: 2x2 black image
    const baselineImage = new PNG({ width: 2, height: 2 })
    baselineImage.data = Buffer.from([
      0,
      0,
      0,
      255,
      0,
      0,
      0,
      255, // Row 1
      0,
      0,
      0,
      255,
      0,
      0,
      0,
      255, // Row 2
    ])

    // New: 2x3 image, top 2 rows black, bottom row white
    const newImage = new PNG({ width: 2, height: 3 })
    newImage.data = Buffer.from([
      0,
      0,
      0,
      255,
      0,
      0,
      0,
      255, // Row 1 (same)
      0,
      0,
      0,
      255,
      0,
      0,
      0,
      255, // Row 2 (same)
      255,
      255,
      255,
      255,
      255,
      255,
      255,
      255, // Row 3 (different)
    ])

    const { diffRatio, diffMask } = diffImages(newImage, baselineImage)

    // Comparison area is 2x3 = 6 pixels. 2 pixels differ (the bottom row).
    // Expected ratio = 2 / 6 = 1/3
    expect(diffRatio).toBeCloseTo(1 / 3)
    expect(diffMask.width).toBe(2)
    expect(diffMask.height).toBe(3) // Diff mask takes the max height

    // Verify diffMask shows differences only in the bottom row
    // Rows 1 & 2 should be transparent black (0,0,0,0)
    // Row 3 should be white (255,255,255,255)
    expect(Array.from(diffMask.data)).toEqual([
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0, // Row 1
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0, // Row 2
      255,
      255,
      255,
      255,
      255,
      255,
      255,
      255, // Row 3
    ])
  })

  it("should handle mismatched heights (baseline image taller)", () => {
    // New: 2x2 black image
    const newImage = new PNG({ width: 2, height: 2 })
    newImage.data = Buffer.from([
      0,
      0,
      0,
      255,
      0,
      0,
      0,
      255, // Row 1
      0,
      0,
      0,
      255,
      0,
      0,
      0,
      255, // Row 2
    ])

    // Baseline: 2x3 image, top 2 rows black, bottom row white
    const baselineImage = new PNG({ width: 2, height: 3 })
    baselineImage.data = Buffer.from([
      0,
      0,
      0,
      255,
      0,
      0,
      0,
      255, // Row 1 (same)
      0,
      0,
      0,
      255,
      0,
      0,
      0,
      255, // Row 2 (same)
      255,
      255,
      255,
      255,
      255,
      255,
      255,
      255, // Row 3 (different)
    ])

    const { diffRatio, diffMask } = diffImages(newImage, baselineImage)

    // Comparison area is 2x3 = 6 pixels. 2 pixels differ (the bottom row).
    // Expected ratio = 2 / 6 = 1/3
    expect(diffRatio).toBeCloseTo(1 / 3)
    expect(diffMask.width).toBe(2)
    expect(diffMask.height).toBe(3) // Diff mask takes the max height

    // Verify diffMask shows differences only in the bottom row
    expect(Array.from(diffMask.data)).toEqual([
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0, // Row 1
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0, // Row 2
      255,
      255,
      255,
      255,
      255,
      255,
      255,
      255, // Row 3
    ])
  })

  it("should throw error for mismatched widths", () => {
    const image1 = new PNG({ width: 2, height: 2 })
    image1.data = Buffer.alloc(2 * 2 * 4) // Dummy data
    const image2 = new PNG({ width: 3, height: 2 })
    image2.data = Buffer.alloc(3 * 2 * 4) // Dummy data

    expect(() => diffImages(image1, image2)).toThrow(
      "Image widths must match for comparison: 2 vs 3",
    )
  })
})

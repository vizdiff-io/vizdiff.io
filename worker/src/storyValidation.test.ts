import { describe, expect, it } from "vitest"

import { validateStoryIdentifiers } from "./stories"
import type { Story } from "./types"

function makeStory(overrides: Partial<Story>): Story {
  return {
    id: "comp--default",
    kind: "Comp",
    name: "Default",
    title: "Comp",
    importPath: "./Comp.stories.tsx",
    componentPath: "./Comp.stories.tsx",
    tags: [],
    ...overrides,
  }
}

describe("validateStoryIdentifiers", () => {
  it("accepts stories with normal-length identifiers", () => {
    const stories = { "comp--default": makeStory({}) }
    expect(() => validateStoryIdentifiers(stories, 2048)).not.toThrow()
  })

  it("rejects an over-long story name", () => {
    const stories = { "comp--default": makeStory({ name: "x".repeat(50) }) }
    expect(() => validateStoryIdentifiers(stories, 16)).toThrow(/name too long/)
  })

  it("rejects an over-long story id", () => {
    const longId = "x".repeat(50)
    const stories = { [longId]: makeStory({ id: longId }) }
    expect(() => validateStoryIdentifiers(stories, 16)).toThrow(/too long/)
  })

  it("rejects an over-long story key even if the story.id is short", () => {
    const longKey = "x".repeat(50)
    const stories = { [longKey]: makeStory({ id: "short" }) }
    expect(() => validateStoryIdentifiers(stories, 16)).toThrow(/key too long/)
  })

  it("is a no-op when the limit is disabled (<= 0)", () => {
    const stories = { "comp--default": makeStory({ name: "x".repeat(10000) }) }
    expect(() => validateStoryIdentifiers(stories, 0)).not.toThrow()
  })
})

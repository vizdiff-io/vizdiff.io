export interface Viewport {
  name: string
  styles: ViewportStyles
  type: "desktop" | "mobile" | "tablet" | "other"
}

export interface ViewportStyles {
  height: string
  width: string
}

export type ViewportMap = Record<string, Viewport>

export interface ViewportsParam {
  defaultViewport?: string
  viewports?: ViewportMap
  options?: ViewportMap
  disable?: boolean
  disabled?: boolean
}

export interface StoryParameters {
  viewport?: ViewportsParam
}

export interface Story {
  id: string
  kind: string
  name: string
  title: string
  importPath: string
  componentPath: string
  tags: string[]

  // argTypes
  args?: Record<string, unknown>
  globals?: { viewport?: { value: string } }
  initialArgs?: Record<string, unknown>

  parameters?: StoryParameters
}

export interface SetViewportOptions {
  width: number
  height: number
  devicePixelRatio?: number
}

export type StorybookWindow = {
  __STORYBOOK_PREVIEW__?: {
    ready: boolean
    extract: () => Promise<Record<string, Story>>
    storyStore?: {
      cacheAllCSFFiles: () => Promise<void>
    }
  }
}

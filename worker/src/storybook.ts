type StorybookWindow =
  | Partial<{
      __STORYBOOK_STORY_STORE__?: {
        getSelection: () => { status: string }
      }

      __STORYBOOK_PREVIEW__: {
        ready: boolean
      }
    }>
  | undefined

export type { StorybookWindow }

import { createTheme, CssBaseline, type ThemeOptions } from "@mui/material"
import { ThemeProvider } from "@mui/material"
import type { Meta, StoryObj, StoryContext } from "@storybook/react"
import { Inter } from "next/font/google"
import { useEffect, type ComponentType, useState, useMemo } from "react"

import DarkMode from "@/components/DarkMode"
import { DarkModeContext } from "@/hooks/useDarkMode"
import baseTheme, { COLORS } from "@/lib/theme"

import HomeComponent from "../pages/index"

const inter = Inter({ subsets: ["latin"] })

function ThemeWrapper({
  mode,
  children,
}: {
  mode: "light" | "dark"
  children: React.ReactNode
}): JSX.Element {
  const [isThemeReady, setIsThemeReady] = useState(false)
  const isDarkMode = mode === "dark"

  const theme = useMemo(() => {
    const themeOptions: ThemeOptions = { ...baseTheme, palette: { mode } }
    return createTheme(themeOptions)
  }, [mode])

  useEffect(() => {
    // Set CSS variables in the document root
    const root = document.documentElement
    Object.entries(COLORS).forEach(([name, colorByTheme]) => {
      const cssVarName = `--${name}`
      root.style.setProperty(cssVarName, colorByTheme[mode])
    })
    setIsThemeReady(true)
  }, [mode])

  if (!isThemeReady) {
    return <div style={{ visibility: "hidden" }} />
  }

  return (
    <DarkModeContext.Provider value={{ isDarkMode }}>
      <DarkMode mode={mode}>
        <ThemeProvider theme={theme}>
          <CssBaseline />
          <div className={inter.className}>{children}</div>
        </ThemeProvider>
      </DarkMode>
    </DarkModeContext.Provider>
  )
}

type StoryArgs = {
  mode?: "light" | "dark"
}

const meta: Meta<typeof HomeComponent> = {
  component: HomeComponent,
  argTypes: {
    mode: {
      control: "radio",
      options: ["light", "dark"],
      defaultValue: "light",
    },
  },
  decorators: [
    (Story: ComponentType, context: StoryContext<StoryArgs>): JSX.Element => (
      <ThemeWrapper mode={context.args.mode ?? "light"}>
        <Story />
      </ThemeWrapper>
    ),
  ],
}

export default meta
type Story = StoryObj<typeof HomeComponent>

export const Home: Story = {
  render: () => <HomeComponent />,
}

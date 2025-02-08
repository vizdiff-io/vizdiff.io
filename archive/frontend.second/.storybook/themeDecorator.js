import React from "react"
import { ThemeProvider } from "@material-ui/core/styles"
import theme from "../theme"

const ThemeDecorator = (storyFn) => <ThemeProvider theme={theme}>{storyFn()}</ThemeProvider>

export default ThemeDecorator

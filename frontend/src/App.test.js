import React from "react"
import { render } from "@testing-library/react"
import { BrowserRouter } from "react-router-dom"
import { Provider } from "react-redux"
import { store } from "./app/store"
import theme from "./theme"
import { ThemeProvider } from "@material-ui/core/styles"
import App from "./App"

test("renders learn react link", () => {
  const { getAllByText } = render(
    <BrowserRouter>
      <ThemeProvider theme={theme}>
        <Provider store={store}>
          <App />
        </Provider>
      </ThemeProvider>
    </BrowserRouter>,
  )

  expect(getAllByText(/VizDiff/i).length).toBeGreaterThan(0)
})

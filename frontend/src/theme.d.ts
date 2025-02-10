declare module "@mui/material/styles" {
  interface Palette {
    customColor: Palette["primary"]
  }
  interface PaletteOptions {
    customColor?: PaletteOptions["primary"]
  }
}

declare module "@mui/material/Button" {
  interface ButtonPropsColorOverrides {
    customColor: true
  }
}

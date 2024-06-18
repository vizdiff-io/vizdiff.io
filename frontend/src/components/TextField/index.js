import React from "react"
import css from "classnames"
import { makeStyles } from "@material-ui/core/styles"
import MUITextField from "@material-ui/core/TextField"

const useStyles = makeStyles((theme) => ({
  input: {
    "& fieldset": {
      borderRadius: "0",
    },

    "& .MuiInputBase-input.Mui-disabled": {
      backgroundColor: theme.palette.shades.charcoal004,
    },
  },
}))

const TextField = ({ formHelperText, ...props }) => {
  const classes = useStyles()
  return <MUITextField {...props} className={css(props.className, classes.input)} />
}

export default TextField

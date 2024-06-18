import React from 'react';
import { makeStyles } from '@material-ui/core/styles';
import { InputAdornment } from '@material-ui/core';
import { default as MUIAutocomplete } from '@material-ui/lab/Autocomplete';
import SearchIcon from '@mui/icons-material/Search';

import global from 'styles/global';
import TextField from 'components/TextField';

const useStyles = makeStyles((theme) => ({
  adornedStart: {
    color: theme.palette.shades.greyNew,
  },
  input: {
    color: theme.palette.shades.jetBlack,
  },
  option: {
    // Hover
    '&[data-focus="true"]': {
      backgroundColor: theme.palette.brand.payBlue,
      color: theme.palette.shades.white,
    },
    // Selected
    '&[aria-selected="true"]': {
      backgroundColor: theme.palette.brand.payBlue,
      color: theme.palette.shades.white,
    },
  },
  inputAdornment:{
    paddingLeft: theme.spacing(1),
  }
}));

const Autocomplete = ({ ...props }) => {
  const classes = useStyles();
  const g = global();

  const { textInputProps } = props;
  return (
    <MUIAutocomplete
      margin="dense"
      size="small"
      fullWidth
      classes={{
        input: classes.input,
        option: classes.option,
      }}
      renderInput={(params) => (
        <TextField
          {...params}
          {...textInputProps}
          variant="outlined"
          classes={{
            adornedStart: classes.adornedStart,
            notchedOutline: classes.notchedOutline,
          }}
          InputProps={{
            ...params.InputProps,
            startAdornment: (
              <InputAdornment position="start" className={classes.inputAdornment}>
                <SearchIcon fontSize="small" />
              </InputAdornment>
            ),
            classes: {
              adornedStart: classes.adornedStart,
            },
          }}
        />
      )}
      {...props}
    />
  );
};

export default Autocomplete;

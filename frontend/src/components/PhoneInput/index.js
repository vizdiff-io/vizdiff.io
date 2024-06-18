import React from 'react';
import InputAdornment from '@material-ui/core/InputAdornment';
import NumberFormat from 'react-number-format';
import { makeStyles } from '@material-ui/core/styles';

import TextField from 'components/TextField';

const useStyles = makeStyles((theme) => ({
    countryCode: {
        paddingTop: theme.spacing(0.25),
    }
  }));

const NumberFormatCustom = (props) => {
  const { inputRef, onChange, ...other } = props;

  return (
    <NumberFormat
      {...other}
      getInputRef={inputRef}
      onValueChange={(values) => {
        onChange({
          target: {
            name: props.name,
            value: values.value,
          },
        });
      }}
      isNumericString
      format="(###) ###-####"
      _mask="_"
    />
  );
};

const USCountryCodeAdornment = (props) => {
  const { inputRef, onChange, ...other } = props;

  const classes = useStyles();

  return <InputAdornment className={classes.countryCode} {...other} position="start" />;
};
const PhoneInput = (props) => {
  return (
    <TextField
      {...props}
      value={props.value}
      InputProps={{
        inputComponent: NumberFormatCustom,
        startAdornment: <USCountryCodeAdornment>+1</USCountryCodeAdornment>,
      }}
    />
  );
};

export default PhoneInput;

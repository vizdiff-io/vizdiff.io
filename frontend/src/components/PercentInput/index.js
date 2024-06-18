import React from 'react';
import InputAdornment from '@material-ui/core/InputAdornment';
import NumberFormat from 'react-number-format';
import TextField from 'components/TextField';

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
      max={100}
      min={0}
    />
  );
};

const PercentAdornment = (props) => {
  const { inputRef, onChange, ...other } = props;

  return <InputAdornment {...other} position="end" />;
};
const PercentInput = (props) => {
  return (
    <TextField
      {...props}
      value={props.value}
      variant="outlined"
      InputProps={{
        inputComponent: NumberFormatCustom,
        endAdornment: <PercentAdornment>%</PercentAdornment>,
      }}
    />
  );
};

export default PercentInput;

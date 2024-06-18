import React from 'react';
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
      prefix="$"
      decimalScale={2}
      thousandSeparator
      isNumericString
    />
  );
};

const DollarInput = (props) => {
  return (
    <TextField
      {...props}
      value={props.value}
      InputProps={{
        inputComponent: NumberFormatCustom,
      }}
    />
  );
};

export default DollarInput;

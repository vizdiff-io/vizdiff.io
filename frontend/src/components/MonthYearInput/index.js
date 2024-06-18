import React from 'react';
import NumberFormat from 'react-number-format';

import TextField from 'components/TextField';

const NumberFormatCustom = (props) => {
  const { inputRef, onChange, ...other } = props;

    // taken from react-number-format docs

  function limit(val, max) {
    if (val.length === 1 && val[0] > max[0]) {
      val = '0' + val;
    }
  
    if (val.length === 2) {
      if (Number(val) === 0) {
        val = '01';
  
        //this can happen when user paste number
      } else if (val > max) {
        val = max;
      }
    }
  
    return val;
  }

  function cardExpiry(val) {
    let month = limit(val.substring(0, 2), '12');
    let year = val.substring(2, 4);

    return month + (year.length ? '/' + year : '');
  }

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
      format={cardExpiry}
    />
  );
};

const MonthYearInput = (props) => {
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

export default MonthYearInput;

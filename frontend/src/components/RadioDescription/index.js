import React from 'react';
import {
  FormControl,
  Typography,
  FormControlLabel,
  RadioGroup,
  Radio,
} from '@material-ui/core';

import global from 'styles/global';

export default function RadioDescription({
  options = [],
  value,
  setValue,
  title,
}) {
  const g = global();

  return (
    <FormControl component="fieldset">
      <Typography variant="h5">{title}</Typography>
      <RadioGroup
        value={value}
        onChange={(evt) => setValue(evt.target.value)}
        aria-label="role"
      >
        {options.map((option) => (
          <FormControlLabel
            value={option.value}
            control={<Radio disableRipple color="primary" />}
            label={
              <div className={g.pv_xs}>
                <Typography variant="body1">{option.title}</Typography>
                <Typography variant="subtitle1">
                  {option.description}
                </Typography>
              </div>
            }
          />
        ))}
      </RadioGroup>
    </FormControl>
  );
}

import React from 'react';
import css from 'classnames';
import InfoIcon from '@mui/icons-material/Info';
import { Typography, IconButton } from '@material-ui/core';

import InfoTooltipIcon from 'components/InfoIcon';
import global from 'styles/global';

const TableHeader = ({
  title,
  tooltipText,
  infoText,
  infoCallback,
  children,
}) => {
  const g = global();
  return (
    <div className={css(g.mb_xs, g.flexRowSpacing, g.alignEnd)}>
      <div className={g.flexRow}>
        <Typography
          className={g.mg_zero}
          style={{ lineHeight: '20px !important' }}
          variant="h3"
        >
          {title}
        </Typography>
        {infoText && (
          <IconButton
            onClick={infoCallback}
            className={css(g.p_zero, g.ml_xxs)}
          >
            <InfoIcon style={{ fontSize: '14px' }} />
          </IconButton>
        )}
        {tooltipText && <InfoTooltipIcon height={14} title={tooltipText} />}
      </div>

      {children}
    </div>
  );
};
export default TableHeader;

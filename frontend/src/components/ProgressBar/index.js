import React from 'react';
import css from 'classnames';
import { makeStyles } from '@material-ui/core/styles';
import LinearProgress from '@material-ui/core/LinearProgress';
import Typography from '@material-ui/core/Typography';
import global from 'styles/global';

const useStyles = makeStyles((theme) => ({
  progBar: {
    lineHeight: '4px',
    marginTop: 'auto',
    marginBottom: 'auto',
  },
}));

export default function LinearProgressWithLabel(props) {
  const styles = useStyles();
  const g = global();

  const { label, sublabel, sublabel2 } = props;

  return (
    <div className={g.flexRow}>
      <div className={css(g.mr_md, g.flex, styles.progBar)}>
        <LinearProgress
          variant="determinate"
          {...props}
          className={g.mb_zero}
        />
      </div>
      <div>
        <Typography variant="body2" color="textSecondary" className={g.nowrap}>
          {label}
        </Typography>
        {sublabel && (
          <Typography
            variant="body2"
            color="textSecondary"
            className={g.nowrap}
          >
            {sublabel}
          </Typography>
        )}
        {sublabel2}
      </div>
    </div>
  );
}

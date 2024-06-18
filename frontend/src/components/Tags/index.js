import css from 'classnames';
import { Chip, Typography } from '@material-ui/core';

import global from 'styles/global';

export default function Tags({ tagsList = [] }) {
  const g = global();

  return (
    <>
      {tagsList.length > 0 ? (
        tagsList.map((t) => (
          <Chip
            variant="outlined"
            label={t || ''}
            className={css(g.mr_xs, g.mb_xs)}
          />
        ))
      ) : (
        <Typography variant="p">No tags</Typography>
      )}
    </>
  );
}

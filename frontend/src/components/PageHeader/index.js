import React from 'react';
import { Link, Typography, Breadcrumbs } from '@material-ui/core';
import { useSelector } from 'react-redux';

import { headerDataSelector } from 'slices/misc';
import global from 'styles/global';

const PageHeader = () => {
  const { title, breadcrumbs } = useSelector(headerDataSelector);
  const g = global();

  return (
    <div className={g.mb_lg}>
      <Breadcrumbs separator="›" aria-label="breadcrumb" className={g.white}>
        {Array.isArray(breadcrumbs) &&
          breadcrumbs.map((crumb) =>
            !!crumb.link ? (
              <Link
                key={`breadcrumb-${crumb.label}-${crumb.link}`}
                color="inherit"
                href={crumb.link}
              >
                <Typography variant="h5" className={g.white}>
                  {crumb.label}
                </Typography>
              </Link>
            ) : (
              <Typography
                className={g.white}
                key={`breadcrumb-${crumb.label}-${crumb.link}`}
                variant="h5"
                color="textPrimary"
              >
                {crumb.label}
              </Typography>
            )
          )}
      </Breadcrumbs>

      <Typography variant="h1">{title}</Typography>
    </div>
  );
};
export default PageHeader;

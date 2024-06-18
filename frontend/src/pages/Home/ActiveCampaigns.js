import React from 'react';
import { useSelector } from 'react-redux';
import { CardActions, Typography } from '@material-ui/core';
import css from 'classnames';
import { Link, useHistory } from 'react-router-dom';
import moment from 'moment';
import Card from 'components/Card';

import global from 'styles/global';
import { paymentGroupsStatsSelector } from 'slices/multiSliceSelectors';
import { formatCurrency } from 'util/renderStrings';
import Button from 'components/Button';

function ActiveCampaigns({ paymentGroups }) {
  const g = global();
  const history = useHistory();

  const paymentGroupsStats = useSelector(paymentGroupsStatsSelector);

  return (
    <Card title="Active Campaigns">
      {paymentGroups.slice(0, 5).map((pg) => {
        const { numPayments, totalAmount } = paymentGroupsStats[pg.id] || {};
        return (
          <div className={css(g.flexRowSpacing, g.mb_md)}>
            <div>
              <Link to={`/campaigns/${pg.id}`} className={g.clickable}>
                <Typography variant="h5">{pg.title || '-'}</Typography>
              </Link>
              <Typography variant="subtitle1">{`${numPayments} Payment${
                numPayments !== 1 ? 's' : ''
              }`}</Typography>
            </div>
            <div className={g.textRight}>
              <Typography variant="subtitle2">
                {`Opened ${moment(pg.created_at).fromNow()}`}
              </Typography>
              <Typography variant="h5">
                {formatCurrency(totalAmount)}
              </Typography>
            </div>
          </div>
        );
      })}
      {paymentGroups.length === 0 && (
        <div className={g.centerChildren}>
          <Typography variant="body1">You don't have any campaigns</Typography>
          <Typography variant="subtitle1">
            <Link to="/campaigns/new">Start one now!</Link>
          </Typography>
        </div>
      )}
      {paymentGroups.length > 0 && (
        <CardActions>
          <Button
            className={g.ml_auto}
            onClick={() => history.push('/campaigns')}
            color="primary"
            variant="text"
          >
            See all
          </Button>
        </CardActions>
      )}
    </Card>
  );
}

export default ActiveCampaigns;

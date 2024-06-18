import React from 'react';
import { useDispatch } from 'react-redux';
import { useHistory } from 'react-router-dom';
import css from 'classnames';
import { Typography, Divider, List, ListItem } from '@material-ui/core';

import { dismissNotification } from 'slices/notifications';
import { getDateAndTimeFromIso } from 'util/time';
import Card from 'components/Card';
import global from 'styles/global';

export default function NotificationsSection({ notifications }) {
  const dispatch = useDispatch();
  const history = useHistory();
  const g = global();

  const handleClick = (notification) => {
    if (!notification.dismissed) {
      dispatch(dismissNotification(notification.id));
    }
    history.push(notification.link);
  };

  return (
    <div className={css(g.full_width)}>
      <Card title="Notifications" variant="outlined">
        <List>
          {notifications.length === 0 && (
            <div className={css(g.p_xxl, g.centerChildren)}>
              <Typography variant="h2">No Notifications to show</Typography>
            </div>
          )}
          {notifications.map((notification, idx) => (
            <ListItem
              key={`notification-${notification.text}`}
              button
              onClick={() => handleClick(notification)}
            >
              <div className={css(g.full_width, g.flexRowSpacing)}>
                <Typography
                  variant="body1"
                  className={css({ [g.charcoal052]: notification.dismissed })}
                >
                  {notification.text}
                </Typography>
                <Typography
                  variant="body2"
                  className={css({ [g.charcoal052]: notification.dismissed })}
                >
                  {getDateAndTimeFromIso(notification.created_at)}
                </Typography>
              </div>

              {idx !== notifications.length - 1 && <Divider />}
            </ListItem>
          ))}
        </List>
      </Card>
    </div>
  );
}

import React, { useState } from 'react';
import { CardHeader, Card, CardContent, IconButton } from '@material-ui/core';
import EditIcon from '@mui/icons-material/Edit';
import CloseIcon from '@mui/icons-material/Close';
import DoneIcon from '@mui/icons-material/Done';
import css from 'classnames';
import { makeStyles } from '@material-ui/core/styles';

import global from 'styles/global';

const useStyles = makeStyles((theme) => ({
  card: {
    boxShadow: 'none',
    padding: 0,
  },
  cardHeaderAction: {
    marginTop: 0,
    marginRight: 0,
    padding: 0,
  },
  cardHeaderContent: {
    flexGrow: 0,
    paddingRight: '15px',
  },
  cardContent: {
    paddingTop: 0,
  },
}));

function EditCard({
  children,
  handleSubmit,
  handleCancel,
  title,
  disabled,
  staticContent,
  submitDisabled,
  hideCancel,
}) {
  const [isEditing, setIsEditing] = useState(false);
  const g = global();
  const classes = useStyles();

  const cancel = () => {
    setIsEditing(false);
    handleCancel();
  };

  const submit = async () => {
    await handleSubmit();
    setIsEditing(false);
  };

  return (
    <Card className={css(g.full_width, classes.card)}>
      <CardHeader
        action={
          !isEditing ? (
            <IconButton
              size="small"
              aria-label="editing"
              onClick={() => {
                setIsEditing(true);
              }}
              disabled={disabled}
            >
              <EditIcon />
            </IconButton>
          ) : (
            <div className={css(g.full_width, g.flexRowEnd)}>
              {!hideCancel && <IconButton size="small" onClick={cancel}>
                <CloseIcon className={g.error} />
              </IconButton>}
              <IconButton
                size="small"
                onClick={submit}
                disabled={submitDisabled}
              >
                <DoneIcon
                  className={css(
                    g.cashGreen1,
                    submitDisabled && g.disabledOpacity
                  )}
                />
              </IconButton>
            </div>
          )
        }
        title={title}
        titleTypographyProps={{ variant: 'h3' }}
        classes={{
          action: classes.cardHeaderAction,
          content: classes.cardHeaderContent,
        }}
      />
      <CardContent className={classes.cardContent}>
        {!isEditing && staticContent ? staticContent : children}
      </CardContent>
    </Card>
  );
}

export default EditCard;

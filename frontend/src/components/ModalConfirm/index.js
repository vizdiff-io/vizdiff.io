import React from 'react';
import WarningIcon from '@mui/icons-material/Warning';
import { Typography, CardContent } from '@material-ui/core';
import css from 'classnames';
import Card from 'components/Card';
import Button from 'components/Button';
import global from 'styles/global';

import { Modal, ModalActions } from 'components/Modal';

const ModalConfirm = ({
  open,
  handleClose,
  callback,
  bodyText,
  title,
  buttonText,
  submitting,
  isWarning,
}) => {
  const g = global();

  const handleConfirm = async () => {
    await callback();
    handleClose();
  };

  return (
    <Modal open={open} handleClose={handleClose} fullWidth maxWidth="sm">
      <Card
        title={
          <div className={css(g.flexRow, g.alignCenter)}>
            {isWarning && (
              <WarningIcon fontSize="small" className={css(g.error, g.mr_xs)} />
            )}
            <Typography>{title}</Typography>
          </div>
        }
      >
        <Typography variant="body1">{bodyText}</Typography>
        <ModalActions>
          <Button
            loading={submitting}
            onClick={handleClose}
            color="default"
            variant="contained"
          >
            Cancel
          </Button>
          <Button
            className={g.ml_sm}
            loading={submitting}
            onClick={handleConfirm}
            color={!!isWarning ? 'secondary' : 'primary'}
            variant="contained"
          >
            {buttonText}
          </Button>
        </ModalActions>
      </Card>
    </Modal>
  );
};

export default ModalConfirm;

import React from 'react';
import { Grid, Typography } from '@material-ui/core';
import { useHistory } from 'react-router-dom';

import {
  Modal,
  ModalActions,
  ModalContent,
  ModalTitle,
} from 'components/Modal';
import Button from 'components/Button';
import { ReactComponent as ActivateModalImage } from 'assets/activateModal.svg';

import global from 'styles/global';

const ActivateModal = ({ open, onClose, onboardingPath }) => {
  const g = global();
  const history = useHistory();

  const handleClose = () => {
    onClose();
  };

  const handleClick = () => {
    onClose();
    history.push(onboardingPath);
  };

  return (
    <Modal open={open} onClose={handleClose} fullWidth>
      <ModalTitle onClose={handleClose}>
        <Typography variant="h3" className={g.mb_xl}>
          Before we get started...
        </Typography>
      </ModalTitle>
      <ModalContent>
        <Grid container spacing={1} className={g.centerChildren}>
          <Grid item xs={12}>
            <ActivateModalImage />
          </Grid>
          <Grid item xs={12}>
            <Typography
              component="p"
              variant="body2"
              className={[g.textCenter, g.mb_xl]}
            >
              To process payments, we are legally required to collect details
              about you and your business, such as SSN, birth date, and EIN
              (where applicable). This information will not be shared with any
              third parties.
            </Typography>
          </Grid>
        </Grid>
      </ModalContent>
      <ModalActions>
        <Button onClick={handleClose} color="primary" variant="outlined">
          Cancel
        </Button>
        <Button onClick={handleClick} color="primary" variant="contained">
          Let's go!
        </Button>
      </ModalActions>
    </Modal>
  );
};

export default ActivateModal;

import React, { useState } from 'react';
import { Typography } from '@material-ui/core';
import isEmail from 'validator/lib/isEmail';

import Button from 'components/Button';
import {
  Modal,
  ModalContent,
  ModalActions,
  ModalTitle,
} from 'components/Modal';
import TextField from 'components/TextField';

const ForgotPasswordModal = ({
  open,
  onClose,
  sendPasswordReset,
  sendPasswordResetState,
}) => {
  const [email, setEmail] = useState('');
  const { loading: submitting } = sendPasswordResetState;

  const isInputInvalid = email === '' || !isEmail(email);

  const handleClose = () => {
    setEmail('');
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={handleClose}
      aria-labelledby="form-dialog-title"
      fullWidth
    >
      <ModalTitle onClose={handleClose}>
        <Typography variant="h3">Reset Password</Typography>
      </ModalTitle>
      <ModalContent>
        <Typography varaint="body2">
          Enter your email to receive a reset password link.
        </Typography>
        <TextField
          margin="dense"
          variant="outlined"
          label="Email address"
          name="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          fullWidth
        />
      </ModalContent>
      <ModalActions>
        <Button onClick={handleClose} color="primary" variant="outlined">
          Cancel
        </Button>
        <Button
          onClick={() => {
            sendPasswordReset({ email });
            handleClose();
          }}
          disabled={isInputInvalid}
          loading={submitting}
          color="primary"
          variant="contained"
        >
          Reset
        </Button>
      </ModalActions>
    </Modal>
  );
};

export { ForgotPasswordModal };

import React, { useState } from 'react';
import { Grid, Box, Link } from '@material-ui/core';
import { useSelector } from 'react-redux';

import { currentUserSelector } from 'slices/users';
import ChangePasswordModal from 'pages/Settings/ChangePasswordModal';
import global from 'styles/global';
import Card from 'components/Card';
import { getIsDev } from 'util/env';
import ChangeAvatarModal from 'components/ChangeAvatarModal';
import KeyValuePair from 'components/KeyValuePair';
import Button from 'components/Button';

function AccountSettingsSection({ handleUpdatePassword, updatePasswordState }) {
  const g = global();
  const isDev = getIsDev();
  const {
    data: { email },
  } = useSelector(currentUserSelector);

  const [changePasswordModalOpen, setChangePasswordModalOpen] = useState(false);
  const [changeAvatarModaOpen, setChangeAvatarModalOpen] = useState(false);
  const showChangePasswordModal = () => {
    setChangePasswordModalOpen(true);
  };
  const showChangeAvatarModal = () => {
    setChangeAvatarModalOpen(true);
  };
  const hideChangePasswordModal = () => {
    setChangePasswordModalOpen(false);
  };
  const hideChangeAvatarModal = () => {
    setChangeAvatarModalOpen(false);
  };

  return (
    <Card title="My account" variant="outlined">
      <ChangeAvatarModal
        open={changeAvatarModaOpen}
        onClose={hideChangeAvatarModal}
      />
      <ChangePasswordModal
        open={changePasswordModalOpen}
        onClose={hideChangePasswordModal}
        handleUpdatePassword={handleUpdatePassword}
        updatePasswordState={updatePasswordState}
      />
      <Box>
        <Grid container spacing={3} className={`${g.mt_xxs}`}>
          <Grid item xs={12}>
            <KeyValuePair value={email} label="Email address" />
          </Grid>
          <Grid item xs={12}>
            <Button variant="contained" onClick={showChangePasswordModal}>
              Change password
            </Button>
          </Grid>
          {isDev && (
            <Grid item xs={12}>
              <Link className={g.clickable} onClick={showChangeAvatarModal}>
                Change avatar
              </Link>
            </Grid>
          )}
        </Grid>
      </Box>
    </Card>
  );
}

export default AccountSettingsSection;

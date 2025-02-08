import React, { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import {
  FormControlLabel,
  Typography,
  Checkbox,
  ButtonGroup,
  Grid,
} from '@material-ui/core';
import moment from 'moment';

import Button from 'components/Button';
import EditCard from 'components/EditCard';
import KeyValuePair from 'components/KeyValuePair';
import { getDelimDateFromDateObj } from 'util/time';
import TextField from 'components/TextField';

function Details({ creator, updateCreator, isAgentMangerDetail }) {
  const dispatch = useDispatch();

  const {
    entity_type,
    first_name,
    last_name,
    business_name,
    pronouns,
    bio,
    date_of_birth,
    is_agent,
    is_manager,
    state_tax_id,
  } = creator;

  const [newIsBiz, setNewIsBiz] = useState(false);
  const [newDob, setNewDob] = useState('');
  const [newPronouns, setNewPronouns] = useState('');
  const [newBio, setNewBio] = useState('');
  const [newFirstName, setNewFirstName] = useState('');
  const [newLastName, setNewLastName] = useState('');
  const [newBizName, setNewBizName] = useState('');
  const [newIsAgent, setNewIsAgent] = useState('');
  const [newIsManager, setNewIsManager] = useState('');
  const [newTaxId, setNewTaxId] = useState('');

  useEffect(() => {
    setNewIsBiz(entity_type === 'business');
    setNewDob(moment(date_of_birth).format('YYYY-MM-DD'));
    setNewPronouns(pronouns);
    setNewBio(bio);
    setNewFirstName(first_name);
    setNewLastName(last_name);
    setNewBizName(business_name);
    setNewIsAgent(is_agent);
    setNewIsManager(is_manager);
    setNewTaxId(state_tax_id);
  }, [
    entity_type,
    first_name,
    last_name,
    business_name,
    pronouns,
    bio,
    date_of_birth,
    is_agent,
    is_manager,
    state_tax_id,
  ]);

  const cancelEditing = () => {
    setNewIsBiz(entity_type === 'business');
    setNewFirstName(first_name);
    setNewDob(date_of_birth);
    setNewPronouns(pronouns);
    setNewBio(bio);
    setNewLastName(last_name);
    setNewBizName(business_name);
    setNewIsAgent(is_agent);
    setNewIsManager(is_manager);
    setNewTaxId(state_tax_id);
  };

  const handleUpdateCreator = async () => {
    const updateObj = { id: creator.id };
    if (!newIsBiz) {
      updateObj.entity_type = 'individual';
      updateObj.first_name = newFirstName;
      updateObj.last_name = newLastName;
    } else {
      updateObj.entity_type = 'business';
      updateObj.business_name = newBizName;
    }
    updateObj.date_of_birth = newDob;
    updateObj.state_tax_id = newTaxId;
    if (!isAgentMangerDetail) {
      updateObj.pronouns = newPronouns;
      updateObj.bio = newBio;
    } else {
      updateObj.is_agent = newIsAgent;
      updateObj.is_manager = newIsManager;
    }
    await dispatch(updateCreator(updateObj));
  };

  return (
    <EditCard
      title="Details"
      handleCancel={cancelEditing}
      handleSubmit={handleUpdateCreator}
      staticContent={
        <>
          <KeyValuePair
            label="Entity Type"
            value={newIsBiz ? 'Business' : 'Creator'}
          />
          {!newIsBiz ? (
            <>
              <KeyValuePair label="First name" value={first_name} />
              <KeyValuePair label="Last name" value={last_name} />
            </>
          ) : (
            <KeyValuePair label="Business name" value={business_name} />
          )}

          <KeyValuePair
            label="Date of birth"
            value={
              date_of_birth ? getDelimDateFromDateObj(date_of_birth) : null
            }
          />

          {!isAgentMangerDetail && (
            <>
              <KeyValuePair label="Pronouns" value={pronouns} />
              <KeyValuePair label="Bio" value={bio} />
            </>
          )}

          {isAgentMangerDetail && (
            <>
              <KeyValuePair label="Is Agent" value={is_agent ? 'Yes' : 'No'} />
              <KeyValuePair
                label="Is Manager"
                value={is_manager ? 'Yes' : 'No'}
              />
            </>
          )}

          <KeyValuePair label="State tax ID" value={state_tax_id} />
        </>
      }
    >
      <Grid container spacing={1}>
        <Grid item xs={12}>
          <ButtonGroup fullWidth variant="outlined">
            <Button
              color="primary"
              variant={!newIsBiz ? 'contained' : 'outlined'}
              onClick={() => setNewIsBiz(false)}
            >
              Individual
            </Button>
            <Button
              color="primary"
              variant={newIsBiz ? 'contained' : 'outlined'}
              onClick={() => setNewIsBiz(true)}
            >
              Business
            </Button>
          </ButtonGroup>
        </Grid>

        {newIsBiz ? (
          <Grid item xs={12}>
            <TextField
              label="Business name"
              variant="outlined"
              margin="dense"
              value={newBizName}
              onChange={(evt) => setNewBizName(evt.target.value)}
              fullWidth
            />
          </Grid>
        ) : (
          <>
            <Grid item xs={12}>
              <TextField
                label="First name"
                variant="outlined"
                margin="dense"
                value={newFirstName}
                onChange={(evt) => setNewFirstName(evt.target.value)}
                fullWidth
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                label="Last name"
                variant="outlined"
                margin="dense"
                value={newLastName}
                onChange={(evt) => setNewLastName(evt.target.value)}
                fullWidth
              />
            </Grid>
          </>
        )}

        <Grid item xs={12}>
          <TextField
            type="date"
            margin="dense"
            variant="outlined"
            label="Date of birth"
            InputLabelProps={{
              shrink: true,
            }}
            value={newDob}
            onChange={(e) => setNewDob(e.target.value)}
            required
            fullWidth
          />
        </Grid>
        {isAgentMangerDetail && (
          <>
            <Typography variant="h5">Roles</Typography>
            <Grid item xs={12}>
              <FormControlLabel
                control={<Checkbox checked={newIsAgent} color="primary" />}
                onChange={(evt) => setNewIsAgent(evt.target.checked)}
                label={<span>Agent</span>}
              />
            </Grid>
            <Grid item xs={12}>
              <FormControlLabel
                control={<Checkbox checked={newIsManager} color="primary" />}
                onChange={(evt) => setNewIsManager(evt.target.checked)}
                label={<span>Manager</span>}
              />
            </Grid>
          </>
        )}

        {!isAgentMangerDetail && (
          <>
            <Grid item xs={12}>
              <TextField
                label="Pronouns"
                variant="outlined"
                margin="dense"
                value={newPronouns}
                onChange={(evt) => setNewPronouns(evt.target.value)}
                fullWidth
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                label="Bio"
                variant="outlined"
                margin="dense"
                multiline
                minRows={2}
                value={newBio}
                onChange={(evt) => setNewBio(evt.target.value)}
                fullWidth
              />
            </Grid>
          </>
        )}

        <Grid item xs={12}>
          <TextField
            label="State tax ID"
            variant="outlined"
            margin="dense"
            value={newTaxId}
            onChange={(evt) => setNewTaxId(evt.target.value)}
            fullWidth
          />
        </Grid>
      </Grid>
    </EditCard>
  );
}

export default Details;

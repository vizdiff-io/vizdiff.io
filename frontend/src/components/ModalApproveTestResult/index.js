import React from "react"
import WarningIcon from "@mui/icons-material/Warning"
import { Grid, Typography, makeStyles } from "@material-ui/core"
import css from "classnames"
import Card from "components/Card"
import Button from "components/Button"
import global from "styles/global"

import { Modal, ModalActions } from "components/Modal"

const useStyles = makeStyles((theme) => ({
  container: {
    height: "calc(75vh - 64px)",
  },
  image: {
    objectFit: "contain",
    width: "100%",
    height: "100%",
  },
}))

const ModalConfirm = ({
  open,
  handleClose,
  handleNextTest,
  callback,
  title,
  testResult,
  submitting,
  isWarning,
}) => {
  const g = global()
  const classes = useStyles()

  const handleConfirm = async () => {
    await callback()
    handleClose()
  }

  const handleConfirmAndContinue = async () => {
    await callback()
    handleNextTest()
  }
  return (
    <Modal open={open} handleClose={handleClose} fullWidth maxWidth="lg">
      <Card
        title={
          <div className={css(g.flexRow, g.alignCenter)}>
            {isWarning && <WarningIcon fontSize="small" className={css(g.error, g.mr_xs)} />}
            <Typography>{title}</Typography>
          </div>
        }
      >
        <Grid container spacing={2}>
          <Grid item xs={6}>
            <div className={classes.container}>
              <img className={classes.image} src={testResult?.baselineImageUrl} alt="baseline" />
            </div>
          </Grid>
          <Grid item xs={6}>
            <div className={classes.container}>
              <img className={classes.image} src={testResult?.newImageUrl} alt="new" />
            </div>
          </Grid>
        </Grid>
        {/* <img src={testResult?.diffImageUrl} alt="diff" /> */}

        <ModalActions>
          <Button loading={submitting} onClick={handleClose} color="default" variant="contained">
            Close
          </Button>
          <Button
            className={g.ml_sm}
            loading={submitting}
            onClick={handleConfirm}
            color={!!isWarning ? "secondary" : "primary"}
            variant="contained"
          >
            Approve
          </Button>
          <Button
            className={g.ml_sm}
            loading={submitting}
            onClick={handleConfirmAndContinue}
            color={!!isWarning ? "secondary" : "primary"}
            variant="contained"
          >
            Approve and continue
          </Button>
        </ModalActions>
      </Card>
    </Modal>
  )
}

export default ModalConfirm

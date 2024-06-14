import { withStyles, makeStyles } from '@material-ui/core/styles';
import CloseIcon from '@mui/icons-material/Close';

import {
  Typography,
  IconButton,
  Dialog,
  DialogContent as MuiDialogContent,
  DialogActions as MuiDialogActions,
  DialogTitle as MuiDialogTitle,
  DialogContentText,
} from '@material-ui/core';

const styles = (theme) => ({
  closeButton: {
    position: 'absolute',
    right: theme.spacing(1),
    top: theme.spacing(1),
    color: theme.palette.grey[500],
  },
  title: { display: 'flex' },
  heading: {
    margin: 0,
    padding: theme.spacing(2, 2, 0, 2),
  },
});

const useStyles = makeStyles({
  modal: {
    borderRadius: 0,
  },
});

export const ModalTitle = withStyles(styles)((props) => {
  const { children, classes, notificationText, onClose, ...other } = props;
  return (
    <MuiDialogTitle className={classes.heading}>
      <div className={classes.title}>
        <Typography component="h3" variant="h3" />
        {children}
        {onClose ? (
          <IconButton
            aria-label="close"
            className={classes.closeButton}
            onClick={onClose}
          >
            <CloseIcon size="small" />
          </IconButton>
        ) : null}
      </div>
    </MuiDialogTitle>
  );
});

export const ModalContent = withStyles((theme) => ({
  root: {
    padding: theme.spacing(6, 8, 4, 8),
  },
}))(MuiDialogContent);

export const ModalActions = withStyles((theme) => ({
  root: {
    padding: theme.spacing(2),
  },
}))(MuiDialogActions);

export const Modal = (props) => {
  const classes = useStyles();
  return (
    <Dialog
      {...props}
      borderRadius={0}
      classes={{
        root: classes.modal,
        paper: classes.modal,
      }}
    />
  );
};
export const ModalContentText = DialogContentText;

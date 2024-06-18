// import React, { useState } from 'react';
// import { Typography, Paper } from '@material-ui/core';
// import { makeStyles } from '@material-ui/core/styles';
// import Button from 'components/Button';
// import { useDropzone } from 'react-dropzone';
// import {
//   Modal,
//   ModalContent,
//   ModalActions,
//   ModalTitle,
// } from 'components/Modal';
// import AddIcon from '@mui/icons-material/Add';
// import global from 'styles/global';
// import css from 'classnames';
// const useStyles = makeStyles((theme) => ({
//   errorMessage: {
//     paddingLeft: theme.spacing(2),
//     color: theme.palette.error.main,
//   },
//   dropzone: {
//     flex: 1,
//     display: 'flex',
//     flexDirection: 'column',
//     alignItems: 'center',
//     padding: theme.spacing(8),
//     borderWidth: '2px',
//     borderRadius: 0,
//     borderColor: theme.palette.shades.charcoal036,
//     borderStyle: 'dashed',
//     backgroundColor: theme.palette.shades.charcoal004,
//     color: theme.palette.shades.charcoal036,
//     outline: 'none',
//     transition: 'border 0.24s ease-in-out',
//   },
// }));

// const ChangeAvatarModal = ({ open, onClose }) => {
//   const classes = useStyles();
//   const [error, setError] = useState();
//   const { acceptedFiles, fileRejections, getRootProps, getInputProps } =
//     useDropzone();
//   const g = global();

//   return (
//     <Modal open={open} onClose={onClose} aria-labelledby="form-dialog-title">
//       <ModalTitle onClose={onClose}>
//         <Typography variant="h3">Change avatar</Typography>
//       </ModalTitle>
//       <ModalContent>
//         <Paper className={css(g.mb_xl, g.paper)}>
//           <section className={classes.paperContainer}>
//             <div {...getRootProps({ className: classes.dropzone })}>
//               <input {...getInputProps()} />
//               <AddIcon style={{ fontSize: 60 }} className={g.charcoal036} />
//               <Typography variant="body1">
//                 Drag and drop new avatar image
//               </Typography>
//             </div>
//             <aside>
//               <Typography variant="body1" className={css(g.error, g.mt_sm)}>
//                 {error}
//               </Typography>
//             </aside>
//           </section>
//         </Paper>
//       </ModalContent>
//       <div> {error && <p className={classes.errorMessage}>{error}</p>}</div>
//       <ModalActions>
//         <Button onClick={onClose} color="primary" variant="outlined">
//           Update
//         </Button>
//         <Button onClick={onClose} color="primary" variant="outlined">
//           Cancel
//         </Button>
//       </ModalActions>
//     </Modal>
//   );
// };

// export default ChangeAvatarModal;

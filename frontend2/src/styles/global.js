import { makeStyles } from '@material-ui/core/styles';

export const colors = {
  brand: {
    oxfordBlue: '#042B4A',
    charcoal: '#262D30',
    payBlue: '#2445E5',
    payBlack: '#1A1C1E',
    slate: '#DCDCDC',
    white: '#FFFFFF',
    jetBlack: '#000000',
  },

  cash: {
    green1: '#006D48',
    green2: '#00F865',
    green3: '#85FFB6',
  },

  card: {
    blue1: '#003399',
    blue2: '#3366CC',
    blue3: '#99CCFF',
  },

  grow: {
    pink1: '#8E0069',
    pink2: '#F30095',
    pink3: '#FF7EDE',
  },

  shades: {
    white: '#FFFFFF',
    offWhite: '#FAFAFA',
    charcoal: '#262D30',
    charocal095: '#006D48',
    charcoal083: '#262D30',
    charcoal80: '#313435',
    charcoal076: '#364044',
    charcoal068: '#364044',
    charcoal052: '#717E84',
    charcoal036: '#9CA6AB',
    charcoal020: '#C8CED0',
    charcoal004: '#F4F5F5',

    charcoalNew: '#9C9C9C',
    charcoalNew2: '#E8E8E8',

    lightBlueNew: '#E9EDFF',
    lightBlueNewDarkened: '#b8c5ff',

    lightRedNew: '#FFE7E7',
    lightRedNewDarkened: '#ffb6b6',

    grey: '#DCDCDC',
    greyNew: '#767676',

    jetBlack: '#000000',
    jetBlack092: '#121517',
  },
  success: {
    main: '#4caf50',
    light: '#81c784',
    dark: '#388e3c',
  },
  error: {
    main: '#FF2828',
  },
  primary: {
    main: '#2343DF',
    light: '#A4B2F4',
  },

  custom: {
    payBlue: '#2445E5',
    payBlue068: '#112792',
    payBlue048: '#2445E5',
    payBlue036: '#5B74EC',
    payBlue020: '#A4B2F4',
    payBlue004: '#EDF0FD',

    cashGreen089: '#006D48',
    cashGreen051: '#00F865',
    cashGreen020: '#85FFB6',
    cashGreen004: '#EBFFF3',

    cardBlue070: '#006D48',
    cardBlue050: '#3366CC',
    cardBlue020: '#AEC2EA',
    cardBlue004: '#EBF5FF',

    oxfordBlue: '#042B4A',

    sigYellow: '#FFC921',
    pending: 'rgba(0,0,0,.2)',
  },
};

export const combineStyles = (...args) => {
  return args.join(' ');
};
const useStyles = makeStyles((theme) => ({
  cardContainer: {
    width: '100%',
    display: 'flex',
    justifyContent: 'space-between',
    flexDirection: 'column',
  },
  flexRowCenter: {
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  flexRowEven: {
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-evenly',
  },
  flexRowSpacing: {
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  flexRow: {
    display: 'flex',
    flexDirection: 'row',
  },
  flexRowEnd: {
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  flexEnd: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-end',
  },
  paper: {
    padding: theme.spacing(2),
  },
  tableWrapper: { display: 'flex', height: '100%', width: '100%' },
  alignCenter: { alignItems: 'center' },
  alignStart: { alignItems: 'flex-start' },
  alignStart_i: { alignItems: 'flex-start !important' },
  alignEnd: { alignItems: 'flex-end' },
  justifyEnd: { justifyContent: 'flex-end' },
  justifySpaceBetween: { justifyContent: 'space-between' },
  justifyEven: { justifyContent: 'space-evenly' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  centerChildren: {
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
  },
  clickable: { cursor: 'pointer' },
  noOverflow: { overflow: 'hidden' },
  nowrap: { whiteSpace: 'nowrap' },
  wrapAnywhere: { overflowWrap: 'anywhere' },
  hide: { display: 'none' },
  textCenter: {
    textAlign: 'center',
  },
  textRight: {
    textAlign: 'right',
  },
  noUnderline: {
    textDecoration: 'none',
  },

  flex: { flex: 1 },
  display_flex: { display: 'flex' },
  stretch: { alignSelf: 'stretch' },
  absolute: { position: 'absolute' },
  relative: { position: 'relative' },
  right: { right: 0 },

  m_zero: { margin: 0 },
  m_zero_i: { margin: '0 !important' },
  m_xxs: { margin: theme.spacing(0.5) },
  m_xs: { margin: theme.spacing(1) },
  m_sm: { margin: theme.spacing(1.5) },
  m_md: { margin: theme.spacing(2) },
  m_lg: { margin: theme.spacing(3) },
  m_xl: { margin: theme.spacing(4) },
  m_xxl: { margin: theme.spacing(5) },

  mb_auto: { marginBottom: 'auto' },
  mb_zero: { marginBottom: 0 },
  mb_zero_i: { marginBottom: '0 !important' },
  mb_xxs: { marginBottom: theme.spacing(0.5) },
  mb_xs: { marginBottom: theme.spacing(1) },
  mb_sm: { marginBottom: theme.spacing(1.5) },
  mb_md: { marginBottom: theme.spacing(2) },
  mb_md_i: { marginBottom: `${theme.spacing(2)}px !important` },
  mb_lg: { marginBottom: theme.spacing(3) },
  mb_xl: { marginBottom: theme.spacing(4) },
  mb_xl_i: { marginBottom: `${theme.spacing(4)}px !important` },
  mb_xxl: { marginBottom: theme.spacing(5) },

  mt_auto: { marginTop: 'auto' },
  mt_zero: { marginTop: 0 },
  mt_zero_i: { marginTop: '0 !important' },
  mt_xxs: { marginTop: theme.spacing(0.5) },
  mt_xs: { marginTop: theme.spacing(1) },
  mt_sm: { marginTop: theme.spacing(1.5) },
  mt_md: { marginTop: theme.spacing(2) },
  mt_lg: { marginTop: theme.spacing(3) },
  mt_xl: { marginTop: theme.spacing(4) },
  mt_xxl: { marginTop: theme.spacing(5) },

  mr_xxs: { marginRight: theme.spacing(0.5) },
  mr_xs: { marginRight: theme.spacing(1) },
  mr_sm: { marginRight: theme.spacing(1.5) },
  mr_md: { marginRight: theme.spacing(2) },
  mr_lg: { marginRight: theme.spacing(3) },
  mr_xl: { marginRight: theme.spacing(4) },
  mr_xxl: { marginRight: theme.spacing(5) },

  ml_auto: { marginLeft: 'auto' },
  ml_xxs: { marginLeft: theme.spacing(0.5) },
  ml_xs: { marginLeft: `${theme.spacing(1)}px !important` },
  ml_sm: { marginLeft: `${theme.spacing(1.5)}px !important` },
  ml_md: { marginLeft: theme.spacing(2) },
  ml_lg: { marginLeft: theme.spacing(3) },
  ml_xl: { marginLeft: theme.spacing(4) },
  ml_xxl: { marginLeft: theme.spacing(5) },

  p_zero: { padding: 0 },
  p_xxs: { padding: theme.spacing(0.5) },
  p_xs: { padding: theme.spacing(1) },
  p_sm: { padding: theme.spacing(1.5) },
  p_md: { padding: theme.spacing(2) },
  p_lg: { padding: theme.spacing(3) },
  p_xl: { padding: theme.spacing(4) },
  p_xxl: { padding: theme.spacing(5) },

  ph_xxs: { padding: theme.spacing(0, 0.5) },
  ph_xs: { padding: theme.spacing(0, 1) },
  ph_sm: { padding: theme.spacing(0, 1.5) },
  ph_md: { padding: theme.spacing(0, 2) },
  ph_lg: { padding: theme.spacing(0, 3) },
  ph_xl: { padding: theme.spacing(0, 4) },
  ph_xxl: { padding: theme.spacing(0, 5) },

  pv_xxs: { padding: theme.spacing(0.5, 0) },
  pv_xs: { padding: theme.spacing(1, 0) },
  pv_sm: { padding: theme.spacing(1.5, 0) },
  pv_md: { padding: theme.spacing(2, 0) },
  pv_lg: { padding: theme.spacing(3, 0) },
  pv_xl: { padding: theme.spacing(4, 0) },
  pv_xxl: { padding: theme.spacing(5, 0) },

  pb_zero: { paddingBottom: 0 },
  pb_xxs: { paddingBottom: theme.spacing(0.5) },
  pb_xs: { paddingBottom: theme.spacing(1) },
  pb_sm: { paddingBottom: theme.spacing(1.5) },
  pb_md: { paddingBottom: theme.spacing(2) },
  pb_lg: { paddingBottom: theme.spacing(3) },
  pb_xl: { paddingBottom: theme.spacing(4) },
  pb_xxl: { paddingBottom: theme.spacing(5) },

  pr_xxs: { paddingRight: theme.spacing(0.5) },
  pr_xs: { paddingRight: theme.spacing(1) },
  pr_sm: { paddingRight: theme.spacing(1.5) },
  pr_md: { paddingRight: theme.spacing(2) },
  pr_lg: { paddingRight: theme.spacing(3) },
  pr_xl: { paddingRight: theme.spacing(4) },
  pr_xxl: { paddingRight: theme.spacing(5) },

  pl_zero: { paddingLeft: 0 },
  pl_xxs: { paddingLeft: theme.spacing(0.5) },
  pl_xs: { paddingLeft: theme.spacing(1) },
  pl_sm: { paddingLeft: theme.spacing(1.5) },
  pl_md: { paddingLeft: theme.spacing(2) },
  pl_lg: { paddingLeft: theme.spacing(3) },
  pl_xl: { paddingLeft: theme.spacing(4) },
  pl_xxl: { paddingLeft: theme.spacing(5) },

  gap_xxs: { gap: theme.spacing(0.5) },
  gap_xs: { gap: theme.spacing(1) },
  gap_sm: { gap: theme.spacing(1.5) },
  gap_md: { gap: theme.spacing(2) },
  gap_lg: { gap: theme.spacing(3) },
  gap_xl: { gap: theme.spacing(4) },
  gap_xxl: { gap: theme.spacing(5) },

  z_index_1: { zIndex: 1 },

  full_width: { width: '100%' },
  height_auto: { height: 'auto' },

  // colors
  white: { color: `${colors.shades.white} !important` },
  cashGreen1: { color: colors.cash.green1 },
  cashGreen2: { color: colors.cash.green2 },
  cashGreen3: { color: colors.cash.green3 },
  charcoal: { color: colors.shades.charcoal },
  charocal095: { color: colors.shades.charocal095 },
  charcoal083: { color: colors.shades.charcoal083 },
  charcoal80: { color: colors.shades.charcoal80 },
  charcoal076: { color: colors.shades.charcoal076 },
  charcoal068: { color: colors.shades.charcoal068 },
  charcoal052: { color: colors.shades.charcoal052 },
  charcoal036: { color: colors.shades.charcoal036 },
  charcoal020: { color: colors.shades.charcoal020 },
  charcoal004: { color: colors.shades.charcoal004 },
  jetBlack: { color: colors.shades.jetBlack },
  jetBlack100: { color: colors.shades.jetBlack100 },
  jetBlack092: { color: colors.shades.jetBlack092 },
  success: { color: colors.success.main },
  error: { color: colors.error.main },
  primary: { color: colors.primary.main },

  border_white: { borderColor: colors.shades.white },
  border_charcoal: { borderColor: colors.shades.charcoal },
  border_charocal095: { borderColor: colors.shades.charocal095 },
  border_charcoal083: { borderColor: colors.shades.charcoal083 },
  border_charcoal80: { borderColor: colors.shades.charcoal80 },
  border_charcoal076: { borderColor: colors.shades.charcoal076 },
  border_charcoal068: { borderColor: colors.shades.charcoal068 },
  border_charcoal052: { borderColor: colors.shades.charcoal052 },
  border_charcoal036: { borderColor: colors.shades.charcoal036 },
  border_charcoal020: { borderColor: colors.shades.charcoal020 },
  border_charcoal004: { borderColor: colors.shades.charcoal004 },
  border_jetBlack: { borderColor: colors.shades.jetBlack },
  border_jetBlack092: { borderColor: colors.shades.jetBlack092 },

  border1: {
    borderColor: colors.shades.charcoal076,
    borderWidth: '1px',
    borderRadius: '2px',
    borderStyle: 'solid',
  },

  bg_sigYellow: { backgroundColor: colors.custom.sigYellow },
  bg_cardBlue020: { backgroundColor: colors.custom.cardBlue020 },
  bg_offWhite: { backgroundColor: colors.shades.offWhite },
  bg_slate: { backgroundColor: colors.brand.slate },
  bg_jetBlack: { backgroundColor: colors.brand.jetBlack },

  dropzone: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: theme.spacing(8),
    borderWidth: '2px',
    borderRadius: 0,
    borderColor: theme.palette.shades.charcoal036,
    borderStyle: 'dashed',
    backgroundColor: theme.palette.shades.charcoal004,
    color: theme.palette.shades.charcoal036,
    outline: 'none',
    transition: 'border 0.24s ease-in-out',
  },

  highlighted: {
    backgroundColor: colors.custom.sigYellow,
  },

  cardSubheader: {
    color: colors.brand.jetBlack,
    fontSize: '12px',
    lineHeight: '14px',
    fontWeight: 'normal',
  },

  bigIcon: {
    fontSize: '48px',
  },

  disabledOpacity: {
    opacity: 0.26,
  },
}));

export default useStyles;

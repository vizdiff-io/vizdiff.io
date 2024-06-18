import { recipientRoleLabels } from "constants/labelMaps";

export const formatCurrency = (
  numCents = 0,
  numDecimals = 2,
  supressCommas = false
) => {
  const isNegative = numCents < 0;
  const divisor = 100;
  const amount = Math.abs(numCents / divisor);
  let output = amount.toFixed(numDecimals);
  if (!supressCommas) {
    output = output.replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1,');
  }
  return `${isNegative ? '-' : ''}$${output}`;
};

export const formatPercent = (decimal, numDecimals = 2) => {
  const isNegative = decimal < 0;
  const mutiplier = 100;
  const pct = Math.abs(decimal * mutiplier);
  const output = pct
    .toFixed(numDecimals)
    .replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1,');
  return `${isNegative ? '-' : ''}${output}%`;
};

export const stringToNumberCents = (amountString) => {
  const withoutCommas = `${amountString}`.split(',').join('');
  return Math.round(+withoutCommas * 100);
};

export const formatCreatorName = (creator) => {
  if (!creator) return '-';
  if (creator.entity_type === 'individual') {
    return !!creator.first_name || !!creator.last_name
      ? `${creator.first_name} ${creator.last_name}`
      : creator.email;
  } else {
    return creator.business_name ?? creator.email;
  }
};

export const formatCustomerName = (customer) => {
  if (!customer) return '-';
  return customer.name;
};

export const formatOwnershipOption = (creator) => {
  if (!creator) return '-';
  return creator.email;
};

const stepNameMap = {
  splits: 'Splits',
  commissions: 'Commissions',
  ownership: 'Ownership',
  create_payments: 'Create Payments',
};
export const renderStepName = (stepName) => {
  return stepNameMap[stepName];
};

const platformTypeMap = {
  youtube: 'YouTube',
  twitch: 'Twitch',
  facebook: 'FaceBook',
  onlyfans: 'OnlyFans',
};
export const renderPlaformType = (platform) => {
  return platformTypeMap[platform];
};

export const shortenUUID = (uuid) => uuid.replaceAll('-', '').substring(0, 16);

export const formatContractsSigned = (params, contractsMap) => {
  const paymentContracts = contractsMap[params.row.id];
  if (!paymentContracts) {
    return '-';
  }
  const signed = paymentContracts.filter(
    (contract) => !!contract.signature_date
  );
  return `${signed.length}/${paymentContracts.length} Signed`;
};

export function truncateWithEllipsis(str = '', n) {
  return str.length > n ? str.substring(0, n - 1) + '...' : str;
}

export function maskAcctNumber(str = '') {
  return str.replace(/\d(?=\d{4})/g, '•');
}

const paymentMethodMap = {
  ach: 'Bank account',
  paypal: 'PayPal',
  venmo: 'Venmo',
};
export const renderPaymentMethodName = (method) => {
  return paymentMethodMap[method];
};

const paymentStatusesMap = {
  draft: 'Draft',
  requires_info: 'Requires info',
  processing: 'Processing',
  succeeded: 'Succeeded',
  canceled: 'Canceled',
  failed: 'Failed',
};
export const renderPaymentStatus = (status) => {
  return paymentStatusesMap[status];
};

export const abbreviateCurrency = (num, decimals = 1) => {
  num = Math.abs(num / 100);
  const lookup = [
    { value: 1, symbol: '' },
    { value: 1e3, symbol: 'K' },
    { value: 1e6, symbol: 'M' },
    { value: 1e9, symbol: 'B' },
    { value: 1e12, symbol: 'T' },
  ];
  const rx = /\.0+$|(\.[0-9]*[1-9])0+$/;
  var item = lookup
    .slice()
    .reverse()
    .find(function (item) {
      return num >= item.value;
    });
  if (item?.value === 1) {
    return `$${(num / item.value).toFixed(2)}`;
  }
  return item
    ? `$${(num / item.value).toFixed(decimals).replace(rx, '$1') + item.symbol}`
    : '$0';
};

export const renderTerms = (terms) => {
  if (!terms) return '-';
  return terms === 'due' ? 'Due upon invoice' : `Net ${terms}`;
};

export const renderRecipientRole = (value) => recipientRoleLabels[value];

export const renderFeeStructure = (fee) => {
  const { flat_rate, percentage, cap } = fee;
  if (flat_rate === 0 && +percentage === 0) {
    return 'are free!'
  }
  let feeString = 'cost ';
  if (flat_rate > 0) {
    feeString = feeString.concat(formatCurrency(flat_rate));
  }
  if (flat_rate > 0 && +percentage > 0) {
    feeString = feeString.concat(' + ')
  }
  if (+percentage > 0) {
    feeString = feeString.concat(`${percentage}%`)
  }
  if (!!cap) {
    feeString = feeString.concat(` (max. ${formatCurrency(cap)})`)
  }
  return feeString;
}
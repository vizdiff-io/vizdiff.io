export const flowTypeLabels = {
  outbound: 'Payment',
  deposit: 'Deposit',
  inbound: 'Transfer',
  debit: 'Debit',
};

export const splitSourceLabels = {
  creator: "Creator's split",
  org: "Org's split",
  [undefined]: '-',
};

export const recipientRoleLabels = {
  creator: 'Creator',
  agent: 'Agent',
  manager: 'Manager',
  [undefined]: '-',
};

export const feeLabels = {
  outbound_payment: 'Payment',
  contract: 'Contract',
  invoice_ach: 'Invoice',
  invoice_card: 'Invoice',
  monthly_fee: 'Monthly Fee',
};

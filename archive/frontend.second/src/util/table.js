import { Chip, Typography } from '@material-ui/core';
import { Link } from 'react-router-dom';
import ChevronRight from '@mui/icons-material/ChevronRight';

import Button from 'components/Button';
import { recipientRoleLabels, feeLabels } from 'constants/labelMaps';
import { emptyOrgData } from 'fixtures/org';
import { getDateAndTimeFromIso } from 'util/time';
import objectStates from 'constants/objectStates';
import { colors } from 'styles/global';
import { formatCreatorName, formatCurrency } from './renderStrings';
import Tags from 'components/Tags';
import { contractTypes } from 'constants/contracts';
import { getDelimitedDateFromIso } from './time';

const statusMap = {
  open: <Chip variant="outlined" label="Pending" />,
  posted: (
    <Chip
      variant="outlined"
      label="Posted"
      style={{ color: colors.success.main, borderColor: colors.success.main }}
    />
  ),
  void: <Chip variant="outlined" color="secondary" label="Void" />,
};

const contractStatusMap = {
  sent: <Chip variant="outlined" label="Sent" />,
  signed: (
    <Chip
      variant="outlined"
      label="Signed"
      style={{ color: colors.success.main, borderColor: colors.success.main }}
    />
  ),
  invalidated: (
    <Chip variant="outlined" color="secondary" label="Invalidated" />
  ),
  uploaded: <Chip variant="outlined" color="outlined" label="Uploaded" />,
};

const invoiceStatusMap = {
  processing: <Chip variant="outlined" label="Processing" />,
  succeeded: (
    <Chip
      variant="outlined"
      label="Paid"
      style={{ color: colors.success.main, borderColor: colors.success.main }}
    />
  ),
  requires_info: <Chip variant="outlined" label="Open" />,
  canceled: <Chip variant="outlined" color="secondary" label="Canceled" />,
};

const qbStatusMap = {
  succeeded: (
    <Chip
      variant="outlined"
      label="Succeeded"
      style={{ color: colors.success.main, borderColor: colors.success.main }}
    />
  ),
  failed: <Chip variant="outlined" color="secondary" label="Failed" />,
};

export const renderStatusChip = (params) => statusMap[params.value];
export const renderContractStatusChip = (type, status) => {
  if (type === contractTypes.Uploaded) return contractStatusMap.uploaded;
  if (status === objectStates.canceled) return contractStatusMap.invalidated;
  if (status === objectStates.succeeded) return contractStatusMap.signed;
  if (status === objectStates.requires_info) return contractStatusMap.sent;
  return contractStatusMap.uploaded;
};

export const renderInvoiceStatusChip = (status) => {
  if (status === 'succeeded') return invoiceStatusMap.succeeded;
  if (status === 'processing') return invoiceStatusMap.processing;
  if (status === 'canceled') return invoiceStatusMap.canceled;
  return invoiceStatusMap.requires_info;
};

// Charges Statuses
const chargeStatusMap = {
  succeeded: (
    <Chip
      variant="outlined"
      label="Succeeded"
      style={{ color: colors.success.main, borderColor: colors.success.main }}
    />
  ),
  pending: <Chip variant="outlined" label="Pending" />,
  failed: <Chip variant="outlined" color="secondary" label="Failed" />,
};

export const renderChargeStatusChip = (status) => {
  if (status === 'succeeded') return chargeStatusMap.succeeded;
  if (status === 'failed') return chargeStatusMap.failed;
  return chargeStatusMap.pending;
};

export const renderCreatorCell = (params) => {
  return <Link to={`/creators/${params.row.recipient}`}>{params.value}</Link>;
};
export const renderSplitCell = (params) => {
  return (
    <Link to={`/creators/${params.row.config.owner.id}`}>{params.value}</Link>
  );
};
export const getOwnerValue = (params) => {
  const owner = params.row.config.owner;
  if (!owner) return '-';
  if (!!owner.business_name) {
    return owner.business_name;
  }
  return !!owner.first_name || !!owner.last_name
    ? `${owner.first_name} ${owner.last_name}`
    : owner.email;
};
export const getCreatorValue = (creatorId, creators) => {
  const creator = creators.find((crtr) => crtr.id === creatorId);
  return formatCreatorName(creator);
};
export const renderOrgCell = (params, orgs) => {
  const org = orgs.find((o) => params.row.org_id === o.id) || {};
  let { website = '' } = org;
  if (!website.startsWith('http')) {
    website = 'https://' + website;
  }
  return (
    <a target="_blank" rel="noreferrer noopener" href={website}>
      {org?.name}
    </a>
  );
};
export const getOrgValue = (orgId, orgs = []) => {
  const org = orgs.find((org) => org.id === orgId) || emptyOrgData;
  return org.name;
};

export const renderGroupTitle = (params, groupId) => {
  if (params.value === '-') return '-';
  return <Link to={`/campaigns/${groupId}`}>{params.value}</Link>;
};

export const getGroupValue = (groupId, paymentGroups) => {
  const group = paymentGroups?.find((grp) => grp.id === groupId);
  const name = !!group ? group.title : '-';
  return name;
};

export const renderPostDate = (params) => {
  const date = params.row.date_posted;
  if (!date) return '-';
  return getDateAndTimeFromIso(date);
};

export const renderCreatedAtDate = (params) => {
  const date = params.row.created_at;
  if (!date) return '-';
  return getDateAndTimeFromIso(date);
};

export const renderDateValue = (params) => {
  if (!params.value) return '-';
  return getDelimitedDateFromIso(params.value);
};

export const renderContractTitle = (params) => {
  if (params.value === '-') return '-';
  return <Link to={`/contracts/${params.id}`}>{params.value}</Link>;
};

export const renderCreatorContractTitle = (params) => {
  if (params.value === '-') return '-';
  return <Link to={`/creator/contracts/${params.id}`}>{params.value}</Link>;
};

export const renderInvoiceTitle = (params) => {
  return <Link to={`/invoices/${params.id}`}>{params.value}</Link>;
};

export const renderInvoiceTitleNoLink = (params) => {
  return params.value;
};

export const getPlatformName = (params) => {
  return params.name;
};

export const renderPlatformName = (params) => {
  return (
    <Link to={`/reportProcessing/${params.id}/process`}>{params.name}</Link>
  );
};

export const getPlatformType = (params) => {
  return params.type;
};

export const renderOwnershipCell = (globalStyles, ownerRows) => {
  return (
    <div style={{ overflow: 'hidden' }}>
      {ownerRows.map((row) => (
        <Link
          className={globalStyles.mr_sm}
          key={row.id}
          to={`/creators/${row.owner.id}`}
        >
          <Chip
            variant="outlined"
            label={`${row.owner.email}: ${row.percent}%`}
          />
        </Link>
      ))}
    </div>
  );
};

export const renderPercentageCell = (globalStyles, percent) => {
  return (
    <div style={{ overflow: 'hidden' }}>
      <Chip variant="outlined" label={`${percent}%`} />
    </div>
  );
};

export const renderAuditTrail = (params, setAuditToPreview) => {
  return (
    <Button
      style={{ cursor: 'pointer' }}
      onClick={() => setAuditToPreview(params.row.id)}
    >
      View
    </Button>
  );
};

export const renderRuleAttribution = (
  row,
  ruleAttributionDict,
  setAttrRule
) => {
  if (!ruleAttributionDict[row.id]) return '-';
  const rows = ruleAttributionDict[row.id];
  const totalAmt = rows.reduce((total, row) => total + row._amount, 0);

  return (
    <Button style={{ cursor: 'pointer' }} onClick={() => setAttrRule(row)}>
      {`${rows.length}  row${rows.length > 1 ? 's' : ''} (${formatCurrency(
        totalAmt
      )})`}
    </Button>
  );
};

export const getValueForRuleAttribution = (row, ruleAttributionDict) => {
  if (!ruleAttributionDict[row.id]) return 0;
  const rows = ruleAttributionDict[row.id];
  return rows.length;
};

export const paymentStatusValueMap = {
  [objectStates.draft]: 'Draft',
  [objectStates.requires_info]: 'Awaiting input',
  [objectStates.processing]: 'Pending',
  [objectStates.succeeded]: 'Posted',
  [objectStates.failed]: 'Failed',
};

export const invoiceStatusValueMap = {
  [objectStates.processing]: 'Pending',
  [objectStates.succeeded]: 'Paid',
  [objectStates.canceled]: 'Canceled',
  [objectStates.requires_info]: 'Open',
};

export const contractStatusValueMap = {
  [contractTypes.Uploaded]: 'Uploaded',
  [objectStates.canceled]: 'Invalidated',
  [objectStates.succeeded]: 'Signed',
  [objectStates.requires_info]: 'Sent',
};

export const renderQuickbooksLines = (je) => {
  if (!!je.ref_id) {
    return (
      <div style={{ overflow: 'hidden' }}>
        {je.Line.map((line) => (
          <Typography variant="body2">{`${
            line.JournalEntryLineDetail.PostingType
          } to ${
            line.JournalEntryLineDetail.AccountRef.name
          } for ${formatCurrency(line.Amount * 100)} -- ${
            line.Description
          }`}</Typography>
        ))}
      </div>
    );
  } else {
    return je.error_text;
  }
};

export const renderPaymentLinkIcon = (params) => (
  <Link to={`/payments/${params.row.id}`} style={{ display: 'flex' }}>
    <ChevronRight
      style={{
        marginTop: 'auto',
        marginBottom: 'auto',
        backgroundColor: colors.primary.main,
        color: colors.shades.white,
        borderRadius: '50%',
      }}
      fontSize="medium"
    />
  </Link>
);

export const renderCustomer = (params) => {
  if (!params) return '-';
  return <Link to={`/customers/${params.id}`}>{params.name}</Link>;
};

export const renderQbStatusChip = (je) =>
  qbStatusMap[!!je.ref_id ? 'succeeded' : 'failed'];

export const renderAgentMngrLink = (params) => {
  return <Link to={`/agentsManagers/${params.row.id}`}>{params.value}</Link>;
};

export const renderRecipientCell = (value) => {
  if (value.is_creator) {
    return <Link to={`/creators/${value.id}`}>{formatCreatorName(value)}</Link>;
  } else if (value.is_agent || value.is_manager) {
    return (
      <Link to={`/agentsManagers/${value.id}`}>{formatCreatorName(value)}</Link>
    );
  } else {
    return <div>{formatCreatorName(value)}</div>;
  }
};

export const renderRecipientEmail = (value) => {
  if (value.is_creator) {
    return <Link to={`/creators/${value.id}`}>{value.email}</Link>;
  } else if (value.is_agent || value.is_manager) {
    return <Link to={`/agentsManagers/${value.id}`}>{value.email}</Link>;
  } else {
    return <div>{formatCreatorName(value)}</div>;
  }
};

export const renderTagsCell = (value) => {
  return <Tags tagsList={value.tags} />;
};

export const renderRecipientRole = (params) =>
  recipientRoleLabels[params.value];

export const renderFeeType = (params) => feeLabels[params.value];

export const renderFeeLink = (params) => {
  let toLink = '';
  switch (params.row.type) {
    case 'outbound_payment':
      toLink = `/payments/${params.row.payment_id}`;
      break;
    case 'invoice_ach':
      toLink = `/invoices/${params.row.invoice_id}`;
      break;
    case 'invoice_card':
      toLink = `/invoices/${params.row.invoice_id}`;
      break;
    case 'contract':
      toLink = `/contracts/${params.row.contract_id}`;
      break;
    default:
      return null;
  }
  return (
    <Link to={toLink} style={{ display: 'flex' }}>
      <ChevronRight
        style={{
          marginTop: 'auto',
          marginBottom: 'auto',
          backgroundColor: colors.primary.main,
          color: colors.shades.white,
          borderRadius: '50%',
        }}
        fontSize="medium"
      />
    </Link>
  );
};

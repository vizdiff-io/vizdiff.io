import React from 'react';
import { connect, useSelector } from 'react-redux';

import DataGrid from 'components/DataGrid';
import global from 'styles/global';
import { customersDictSelector } from 'slices/customers';
import { emptyCustomerData } from 'fixtures/customer';
import {
  renderOrgCell,
  getOrgValue,
  invoiceStatusValueMap,
  renderGroupTitle,
  renderInvoiceStatusChip,
  renderInvoiceTitle,
  renderInvoiceTitleNoLink,
} from 'util/table';
import { formatCurrency, renderTerms } from 'util/renderStrings';
import { addDaysToTime, getDelimDateFromDateObj } from 'util/time';
import { paymentGroupDictSelector } from 'slices/paymentGroups';

const InvoicesTable = ({
  checkboxEnabled,
  columnsToDisplay,
  components,
  invoices,
  isRowSelectable,
  onSelectionModelChange,
  orgs,
}) => {
  const g = global();

  const customersDict = useSelector(customersDictSelector);
  const paymentGroupsDict = useSelector(paymentGroupDictSelector);

  const possibleColumns = {
    title: {
      field: 'title',
      headerName: 'Title',
      flex: 2,
      renderCell: (params) => renderInvoiceTitle(params),
      valueFormatter: (params) => params.value,
    },
    titleNoLink: {
      field: 'title',
      headerName: 'Title',
      flex: 2,
      renderCell: (params) => renderInvoiceTitleNoLink(params),
      valueFormatter: (params) => params.value,
    },
    customer: {
      field: 'customer_email',
      headerName: 'Recipient',
      flex: 2,
      renderCell: (params) => {
        const customer =
          customersDict[params.row.customer_id] || emptyCustomerData;
        return customer.email;
      },
      valueGetter: (params) => {
        const customer =
          customersDict[params.row.customer_id] || emptyCustomerData;
        return customer.email;
      },
    },
    amount: {
      field: 'amount',
      headerName: 'Amount',
      renderCell: (params) => formatCurrency(params.value),
      flex: 1,
      valueFormatter: (params) => formatCurrency(params.value),
    },
    net: {
      field: 'net',
      headerName: 'Terms',
      flex: 1,
      valueGetter: (params) => renderTerms(params.value),
    },
    org_id: {
      field: 'org_id',
      headerName: 'Company',
      flex: 2,
      renderCell: (params) => renderOrgCell(params, orgs),
      valueGetter: (params) => getOrgValue(params.value, orgs),
    },

    due_date: {
      field: 'due_date',
      headerName: 'Due Date',
      renderCell: (params) =>
        !!params.row.net
          ? getDelimDateFromDateObj(
              addDaysToTime(params.row.created_at, params.row.net)
            )
          : '-',
      valueGetter: (params) =>
        !!params.row.net
          ? getDelimDateFromDateObj(
              addDaysToTime(params.row.created_at, params.row.net)
            )
          : '-',
      flex: 1,
    },
    status: {
      field: 'status',
      headerName: 'Status',
      renderCell: (params) => {
        return renderInvoiceStatusChip(params.row.status);
      },
      valueGetter: (params) => invoiceStatusValueMap[params.value],
      flex: 1,
      disableColumnMenu: true,
    },
    payment_group_id: {
      field: 'payment_group_id',
      headerName: 'Campaign',
      renderCell: (params) =>
        renderGroupTitle(params, params.row.payment_group_id),
      valueGetter: (params) => {
        const paymentGroup = paymentGroupsDict[params.value] || {};
        return paymentGroup.title;
      },
      flex: 1,
    },
  };
  const columns = columnsToDisplay.map((col) => possibleColumns[col]);

  return (
    <div className={g.tableWrapper}>
      <DataGrid
        autoHeight
        autoPageSize
        rows={invoices}
        columns={columns}
        columnDependencies={[customersDict, paymentGroupsDict, invoices]}
        checkboxSelection={checkboxEnabled}
        disableSelectionOnClick={checkboxEnabled}
        onSelectionModelChange={onSelectionModelChange}
        isRowSelectable={isRowSelectable}
        components={components}
      />
    </div>
  );
};

export default connect()(InvoicesTable);

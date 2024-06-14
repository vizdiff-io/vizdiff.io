import { createSelector } from '@reduxjs/toolkit';
import moment from 'moment';

import {
  creatorsSelector,
  creatorsDictSelector,
  adminsDictSelector,
} from 'slices/users';
import { paymentsSelector, paymentsForCampaignSelector } from 'slices/payments';
import { contractsSelector } from 'slices/contracts';
import { invoicesSelector } from 'slices/invoices';
import { paymentGroupsSelector } from 'slices/paymentGroups';
import objectStates from 'constants/objectStates';
import { emptyCreatorData } from 'fixtures/creatorData';
import { deliverablesForCampaignSelector } from 'slices/deliverables';

const reflectSecond = (_, second) => second;
const reflectThird = (_, __, third) => third;

// returns a dict of { paymentId: creator }
export const creatorsByPaymentIdSelector = createSelector(
  [creatorsSelector, paymentsSelector],
  (creatorsState, paymentsState) => {
    const { data: creators } = creatorsState;
    const { data: payments } = paymentsState;

    const paymentsByCreator = payments.reduce((agg, pmt) => {
      agg[pmt.id] = creators.find((crtr) => crtr.id === pmt.recipient);
      return agg;
    }, {});

    return paymentsByCreator;
  }
);

export const creatorsWithPaymentsSelector = createSelector(
  [creatorsSelector, paymentsSelector],
  (creatorsState, paymentsState) => {
    const { data: creators } = creatorsState;
    const { data: payments } = paymentsState;

    const creatorsWithPayments = creators.reduce((agg, crtr) => {
      const paymentsForCreator = payments.filter(
        (pmt) => pmt.recipient === crtr.id
      );
      agg[crtr.id] = {
        ...crtr,
        payments: paymentsForCreator,
      };
      return agg;
    }, {});

    return creatorsWithPayments;
  }
);

export const paymentsForCampaignWithCreatorsSelector = createSelector(
  [paymentsSelector, creatorsByPaymentIdSelector, reflectSecond],
  (paymentsState, creatorMap, campaignId) => {
    const { data: payments } = paymentsState;

    const paymentsForCampaign = payments.filter(
      (payment) => payment.payment_group_id === campaignId
    );
    const paymentsWithCreators = paymentsForCampaign.map((payment) => ({
      ...payment,
      creator: creatorMap[payment.id] || emptyCreatorData,
    }));
    return paymentsWithCreators;
  }
);

export const paymentGroupsWithPaymentsSelector = createSelector(
  [paymentGroupsSelector, paymentsSelector],
  (paymentGroupsState, paymentsState) => {
    const { data: paymentGroups } = paymentGroupsState;
    const { data: payments } = paymentsState;

    const paymentGroupsWithPayments = paymentGroups.reduce((agg, pGroup) => {
      const paymentsForGroup = payments.filter(
        (pmt) => pmt.payment_group_id === pGroup.id
      );
      agg[pGroup.id] = {
        ...pGroup,
        payments: paymentsForGroup,
      };
      return agg;
    }, {});

    return paymentGroupsWithPayments;
  }
);

export const paymentGroupsStatsSelector = createSelector(
  paymentGroupsWithPaymentsSelector,
  (paymentGroupsWithPayments) => {
    return Object.keys(paymentGroupsWithPayments).reduce((agg, pGroupId) => {
      const { payments } = paymentGroupsWithPayments[pGroupId];
      const completedPayments = payments.filter(
        (pmt) => pmt.status === objectStates.succeeded
      );

      const numPayments = payments.length;
      const totalAmount = payments.reduce((agg, pmt) => agg + pmt.amount, 0);

      const numPosted = completedPayments.length;
      const amountPosted = completedPayments.reduce(
        (agg, pmt) => agg + pmt.amount,
        0
      );

      agg[pGroupId] = {
        numPayments,
        totalAmount,
        amountPosted,
        numPosted,
      };
      return agg;
    }, {});
  }
);

export const todoListSelector = createSelector(
  [paymentsSelector, contractsSelector, invoicesSelector, creatorsDictSelector],
  (paymentsState, contractsState, invoicesState, creatorsDict) => {
    const { data: payments } = paymentsState;
    const { data: contracts } = contractsState;
    const { data: invoices } = invoicesState;
    const now = moment();

    const delinquentPayments = payments
      .filter((payment) => payment.status === objectStates.requires_info)
      .map((payment) => ({
        ...payment,
        todoType: 'payment',
        daysDelinquent: moment(payment.date_info_requested).diff(now, 'days'),
        hasPhone: !!creatorsDict[payment.recipient]?.phone_number,
      }));

    const delinquentContracts = contracts
      .filter((contract) => contract.status === objectStates.requires_info)
      .map((contract) => ({
        ...contract,
        todoType: 'contract',
        daysDelinquent: moment(contract.created_at).diff(now, 'days'),
        hasPhone: !!creatorsDict[contract.creator_id]?.phone_number,
      }));

    const delinquentInvoices = invoices
      .filter((invoice) => invoice.status === objectStates.requires_info)
      .map((invoice) => ({
        ...invoice,
        todoType: 'invoice',
        daysDelinquent: moment(invoice.created_at).diff(now, 'days'),
        hasPhone: !!creatorsDict[invoice.customer_id]?.phone_number,
      }));

    const todos = delinquentPayments
      .concat(delinquentContracts)
      .concat(delinquentInvoices);
    todos.sort((a, b) => b.daysDelinquent - a.daysDelinquent);
    return todos;
  }
);

export const paymentRecipientsDictSelector = createSelector(
  [creatorsDictSelector, adminsDictSelector],
  (creatorsDict, adminsDict) => {
    return { ...creatorsDict, ...adminsDict };
  }
);

export const newPaymentRecipientsDictSelector = createSelector(
  [paymentRecipientsDictSelector],
  (recDict) => {
    const filtered = Object.values(recDict).reduce((agg, rec) => {
      if (rec.is_creator || rec.is_manager || rec.is_agent) {
        agg[rec.id] = rec;
      }
      return agg;
    }, {});
    return filtered || {};
  }
);

export const recipientsWithPaymentsSelector = createSelector(
  [paymentRecipientsDictSelector, paymentsSelector],
  (paymentRecipientsDict, paymentsState) => {
    const { data: payments } = paymentsState;

    const recipientsWithPayments = Object.values(paymentRecipientsDict).reduce(
      (agg, crtr) => {
        const paymentsForRecipient = payments.filter(
          (pmt) => pmt.recipient === crtr.id
        );
        agg[crtr.id] = {
          ...crtr,
          payments: paymentsForRecipient,
        };
        return agg;
      },
      {}
    );

    return recipientsWithPayments;
  }
);

export const creatorsInCampaignSelector = createSelector(
  [
    paymentsForCampaignSelector,
    deliverablesForCampaignSelector,
    creatorsDictSelector,
  ],
  (campaignPayments, campaignDeliverables, creatorsDict) => {
    let creatorsForPayments = campaignPayments.reduce((agg, pmt) => {
      const creatorInfo = creatorsDict[pmt.recipient];
      if (!!creatorInfo) {
        agg[pmt.recipient] = creatorInfo;
      }
      return agg;
    }, {});

    const creatorsForCampaigns = campaignDeliverables.reduce((agg, del) => {
      const creatorInfo = creatorsDict[del.creator_id];
      if (!!creatorInfo) {
        agg[del.creator_id] = creatorInfo;
      }
      return agg;
    }, creatorsForPayments);

    return creatorsForCampaigns;
  }
);

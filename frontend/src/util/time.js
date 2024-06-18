import moment from 'moment';

const outputs = {
  spelledOutMonth: 'MMMM D, YYYY',
  delimitedDate: 'M/D/YYYY',
  dateAndTime: 'M/D/YYYY h:mm A',
};

const inputs = {
  epochMs: (input) => moment(input),
  iso: (input) => moment(input),
  epochSec: (input) => moment(input * 1000),
  dateObj: (input) => moment(input),
};

const makeRenderFn = (inputFormat, outputFormat) => (input) => {
  const m = inputs[inputFormat](input);
  return m.format(outputs[outputFormat]);
};

export const getDelimDateFromDateObj = makeRenderFn('dateObj', 'delimitedDate');
export const getDateAndTimeFromEpochSec = makeRenderFn(
  'epochSec',
  'dateAndTime'
);
export const getDateAndTimeFromIso = makeRenderFn('iso', 'dateAndTime');
export const getDelimitedDateFromIso = makeRenderFn('iso', 'delimitedDate');

export const addDaysToTime = (time, daysToAdd) =>
  moment(time).add(daysToAdd, 'days');

export const formatDateForTimeInput = (date) => {
  if (!date) return '';
  return moment(date).toDate().toISOString().split('T')[0];
};

export const getSpelledOutDateFromIso = makeRenderFn('iso', 'spelledOutMonth');

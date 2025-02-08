import {
  prop,
  pipe,
  map,
  indexBy,
  reduce,
  mergeWith,
  merge,
  values,
} from 'ramda';

const mergeArrays = pipe(
  map(indexBy(prop('id'))),
  reduce(mergeWith(merge), {}),
  values
);

export default mergeArrays;

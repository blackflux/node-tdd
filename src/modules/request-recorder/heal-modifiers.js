import objectScan from 'object-scan';
import cloneDeep from 'lodash.clonedeep';

const healer = objectScan(['**.*|*'], {
  breakFn: ({
    isMatch, depth, property, context
  }) => {
    if (depth === 0) {
      return false;
    }
    context.expected[depth] = context.expected[depth - 1]?.[property];
    context.actual[depth] = context.actual[depth - 1]?.[property];
    return isMatch;
  },
  filterFn: ({
    context, depth, property, value
  }) => {
    const k = property.split('|')[0];
    const parentExpected = context.expected[depth - 1];
    const parentActual = context.actual[depth - 1];
    const childExpected = parentExpected?.[k];
    const childActual = parentActual?.[k];
    if (childExpected === childActual) {
      delete parentActual[k];
      parentActual[property] = value;
    }
  },
  afterFn: ({ context }) => context.actual[0]
});

export default (original, expected, actual, field) => {
  // eslint-disable-next-line no-param-reassign
  original[field] = healer(
    original[field],
    {
      expected: [expected],
      actual: [cloneDeep(actual)]
    }
  );
};

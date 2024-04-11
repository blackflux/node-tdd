import objectScan from 'object-scan';
import cloneDeep from 'lodash.clonedeep';

const healer = objectScan(['**.*|*'], {
  breakFn: ({
    isMatch, depth, property, context
  }) => {
    if (property === undefined) {
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
    if (
      parentActual !== undefined
      && !(childExpected instanceof Object)
      && !(childActual instanceof Object)
      && childExpected === childActual
    ) {
      delete parentActual[k];
      parentActual[property] = value;
    }
  },
  afterFn: ({ context }) => context.actual[0]
});

export default (original, expected, actual) => healer(
  original,
  {
    expected: [expected],
    actual: [cloneDeep(actual)]
  }
);

import objectScan from 'object-scan';
import cloneDeep from 'lodash.clonedeep';

const restorer = objectScan(['**.*|*'], {
  breakFn: ({
    isMatch, depth, property, context
  }) => {
    if (depth === 0) {
      return false;
    }
    context.expected[depth] = context.expected[depth - 1]?.[property];
    context.actual[depth] = context.actual[depth - 1]?.[property];
    return isMatch || (depth === 1 && property !== context.field);
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
  const context = {
    expected: [{ [field]: expected }],
    actual: [{ [field]: cloneDeep(actual) }],
    field
  };
  const restored = restorer(original, context);
  Object.assign(original, restored);
};

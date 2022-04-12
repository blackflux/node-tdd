import objectScan from 'object-scan';

export default (input, modifiers) => {
  objectScan(['**'], {
    filterFn: ({ key, value, parent }) => {
      const k = key[key.length - 1];
      if (typeof k === 'string' && k.includes('|')) {
        const [newKey, ...modifierNames] = k.split('|');
        const unknownModifiers = modifierNames
          .filter((n) => typeof modifiers[n] !== 'function');
        if (unknownModifiers.length !== 0) {
          // eslint-disable-next-line no-console
          console.warn(`Unknown Modifier(s) detected: ${unknownModifiers.join(', ')}`);
          return;
        }
        // eslint-disable-next-line no-param-reassign
        delete parent[k];
        // eslint-disable-next-line no-param-reassign
        parent[newKey] = modifierNames
          .reduce((p, modifierName) => modifiers[modifierName](p), value);
      }
    }
  })(input);
};

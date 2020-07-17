const objectScan = require('object-scan');

module.exports = (input, modifiers) => {
  objectScan(['**'], {
    filterFn: ({ key, value, parent }) => {
      const k = key[key.length - 1];
      if (k.includes('|')) {
        const [prefix, ...toApply] = k.split('|');
        let newKey = prefix;
        let newValue = value;
        for (let idx = 0; idx < toApply.length; idx += 1) {
          const modifierName = toApply[idx];
          const modifier = modifiers[modifierName];
          if (typeof modifier === 'function') {
            newValue = modifier(newValue);
          } else {
            newKey += `|${modifierName}`;
          }
        }
        if (k !== newKey) {
          // eslint-disable-next-line no-param-reassign
          delete parent[key];
        }
        // eslint-disable-next-line no-param-reassign
        parent[newKey] = newValue;
      }
    }
  })(input);
  return input;
};

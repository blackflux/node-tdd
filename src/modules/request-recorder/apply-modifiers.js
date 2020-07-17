const objectScan = require('object-scan');

module.exports = (input, modifiers) => {
  objectScan(['**'], {
    filterFn: ({ key, value, parent }) => {
      const k = key[key.length - 1];
      if (typeof k === 'string' && k.includes('|')) {
        const [prefix, ...modifierNames] = k.split('|');
        let newKey = prefix;
        let newValue = value;
        modifierNames.forEach((modifierName) => {
          const modifier = modifiers[modifierName];
          if (typeof modifier === 'function') {
            newValue = modifier(newValue);
          } else {
            newKey += `|${modifierName}`;
          }
        });
        if (k !== newKey) {
          // eslint-disable-next-line no-param-reassign
          delete parent[k];
        }
        // eslint-disable-next-line no-param-reassign
        parent[newKey] = newValue;
      }
    }
  })(input);
};

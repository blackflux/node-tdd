module.exports.buildKey = (interceptor) => `${interceptor.method} ${interceptor.basePath}${interceptor.uri}`;

module.exports.tryParseJson = (value) => {
  if (typeof value !== 'string') {
    return value;
  }
  try {
    return JSON.parse(value);
  } catch (e) {
    return value;
  }
};

module.exports.nullAsString = (value) => (value === null ? 'null' : value);

module.exports.convertHeaders = (array) => {
  const obj = {};
  for (let idx = 0; idx < array.length; idx += 2) {
    obj[array[idx].toLowerCase()] = array[idx + 1];
  }
  return obj;
};

module.exports.buildKey = (interceptor) => `${interceptor.method} ${interceptor.basePath}${interceptor.uri}`;

module.exports.tryParseJson = (value) => {
  try {
    return JSON.parse(value);
  } catch (e) {
    return value;
  }
};

module.exports.convertHeaders = (array) => {
  const obj = {};
  for (let idx = 0; idx < array.length; idx += 2) {
    obj[array[idx].toLowerCase()] = array[idx + 1];
  }
  return obj;
};

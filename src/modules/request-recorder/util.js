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

module.exports.rewriteHeaders = (headers, fn = (k, v) => v) => {
  if (headers === undefined) {
    return {};
  }
  const headersLower = Object.fromEntries(
    Object.entries(headers)
      .sort(([a], [b]) => (a > b ? 1 : -1))
      .map(([k, v]) => [k.toLowerCase(), v])
  );
  const result = {};
  Object.entries(headersLower).forEach(([k, v]) => {
    result[k] = fn(k, v, headersLower);
  });
  return result;
};

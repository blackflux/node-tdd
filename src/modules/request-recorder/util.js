export const buildKey = (interceptor) => `${interceptor.method} ${interceptor.basePath}${interceptor.uri}`;

export const tryParseJson = (value) => {
  if (typeof value !== 'string') {
    return value;
  }
  try {
    return JSON.parse(value);
  } catch (e) {
    return value;
  }
};

export const nullAsString = (value) => (value === null ? 'null' : value);

export const convertHeaders = (array) => {
  const obj = {};
  for (let idx = 0; idx < array.length; idx += 2) {
    obj[array[idx].toLowerCase()] = array[idx + 1];
  }
  return obj;
};

export const rewriteHeaders = (headers, fn = (k, v) => v) => {
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

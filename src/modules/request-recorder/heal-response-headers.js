export default (interceptor) => {
  const result = [];
  for (let i = 0; i < interceptor.rawHeaders.length; i += 2) {
    const name = interceptor.rawHeaders[i];
    let value = interceptor.rawHeaders[i + 1];
    if (name.toLowerCase() === 'content-length') {
      value = interceptor.body[
        interceptor.body instanceof Buffer ? 'byteLength' : 'length'
      ].toString();
    }
    result.push(name, value);
  }
  return result;
};

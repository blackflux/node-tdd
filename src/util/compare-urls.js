import normalizeUrl from 'normalize-url';

export default (firstUrl, secondUrl) => {
  if (firstUrl === secondUrl) {
    return true;
  }
  const options = {
    removeTrailingSlash: false
  };
  return (
    normalizeUrl(`https://test.com${firstUrl}`, options)
    === normalizeUrl(`https://test.com${secondUrl}`, options)
  );
};

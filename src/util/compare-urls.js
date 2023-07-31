import normalizeUrl from 'normalize-url';

export default (firstUrl, secondUrl) => {
  if (firstUrl === secondUrl) {
    return true;
  }
  const options = {
    removeTrailingSlash: false
  };
  return normalizeUrl(firstUrl, options) === normalizeUrl(secondUrl, options);
};

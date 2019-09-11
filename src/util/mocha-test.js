const getParents = (test) => {
  const names = [];
  let cTest = test;
  while (cTest !== undefined) {
    names.splice(0, 0, cTest.title);
    cTest = cTest.parent;
  }
  return names;
};
module.exports.getParents = getParents;

const genCassetteName = (test) => getParents(test)
  .filter((e) => !!e)
  .map((e) => e
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/^./, (c) => c.toLowerCase())
    .replace(/-(.)/g, (_, char) => char.toUpperCase()))
  .concat(['recording.json'])
  .join('_');
module.exports.genCassetteName = genCassetteName;

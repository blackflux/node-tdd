import nock from 'nock';

export default (() => {
  const fnLists = {
    'no match': []
  };
  Object.entries(fnLists).forEach(([event, fns]) => {
    nock.emitter.on(event, (...args) => fns.forEach((fn) => fn(...args)));
  });
  return {
    subscribe: (event, f) => {
      fnLists[event].push(f);
    },
    unsubscribeAll: (event) => {
      fnLists[event].length = 0;
    }
  };
})();

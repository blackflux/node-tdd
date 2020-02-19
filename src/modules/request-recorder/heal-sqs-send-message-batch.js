const crypto = require('crypto');
const qs = require('querystring');
const get = require('lodash.get');
const uuid4 = require('uuid/v4');
const xml2js = require('xml2js');

const parseRequestBody = (body) => Object.values(Object
  .entries(qs.parse(body))
  .filter(([k, v]) => k.startsWith('SendMessageBatchRequestEntry.'))
  .sort((a, b) => a[0].localeCompare(b[0]))
  .map(([k, v]) => [k.split('.'), v])
  .reduce((p, [k, v]) => {
    if (p[k[1]] === undefined) {
      Object.assign(p, { [k[1]]: {} });
    }
    Object.assign(p[k[1]], { [k[2]]: v });
    return p;
  }, {}));

const parseResponseBody = (body) => {
  let parsed = null;
  xml2js.parseString(body, (err, result) => {
    parsed = result;
  });
  return parsed;
};

module.exports = (requestBody, responseBody, scope) => {
  if (
    !/^https:\/\/sqs\.[a-z0-9-]+\.amazonaws\.com:443$/.test(scope.scope)
    || !responseBody.startsWith('<?xml version="1.0"?><SendMessageBatchResponse')) {
    return responseBody;
  }

  const responseBodyParsed = parseResponseBody(responseBody);

  const resultEntries = parseRequestBody(requestBody)
    .map(({ Id, MessageBody }, idx) => [
      '<SendMessageBatchResultEntry>',
      `<Id>${Id}</Id>`,
      `<MessageId>${
        get(responseBodyParsed, [
          'SendMessageBatchResponse',
          'SendMessageBatchResult',
          0,
          'SendMessageBatchResultEntry',
          idx,
          'MessageId'
        ], uuid4())
      }</MessageId>`,
      `<MD5OfMessageBody>${
        crypto.createHash('md5').update(MessageBody).digest('hex')
      }</MD5OfMessageBody>`,
      '</SendMessageBatchResultEntry>'
    ].join(''));
  return [
    '<?xml version="1.0"?>',
    '<SendMessageBatchResponse xmlns="http://queue.amazonaws.com/doc/2012-11-05/">',
    '<SendMessageBatchResult>',
    ...resultEntries,
    '</SendMessageBatchResult>',
    '<ResponseMetadata>',
    `<RequestId>${
      get(responseBodyParsed, [
        'SendMessageBatchResponse',
        'ResponseMetadata',
        0,
        'RequestId',
        0
      ], uuid4())
    }</RequestId>`,
    '</ResponseMetadata>',
    '</SendMessageBatchResponse>'
  ].join('');
};

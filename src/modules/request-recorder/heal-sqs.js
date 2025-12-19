import crypto from 'crypto';
import { tryParseJson } from './util.js';
import migration from './heal-sqs/migration.js';

export default (requestBody, responseBody, scope, req) => {
  if (!/^https:\/\/sqs\.[\w-]+\.amazonaws\.com:443$/.test(scope?.basePath)) {
    return responseBody;
  }

  const header = req?.options?.headers?.['x-amz-target'];

  if (typeof responseBody === 'string' && responseBody.startsWith('<?xml')) {
    return migration({ responseBody, header });
  }

  const requestJson = tryParseJson(requestBody);
  const responseJson = tryParseJson(responseBody);

  if (header === 'AmazonSQS.SendMessageBatch') {
    return {
      Successful: requestJson.Entries.map(({ Id, MessageBody }, idx) => ({
        Id,
        MessageId: responseJson?.Successful?.[idx]?.MessageId || crypto.randomUUID(),
        MD5OfMessageBody: crypto.createHash('md5').update(MessageBody).digest('hex')
      }))
    };
  }

  return responseBody;
};

import crypto from 'crypto';
import { tryParseJson } from './util.js';

export default (requestBody, responseBody, scope, req) => {
  if (
    scope?.basePath !== 'https://sqs.us-west-2.amazonaws.com:443'
    || req?.options?.headers?.['x-amz-target'] !== 'AmazonSQS.SendMessageBatch'
  ) {
    return responseBody;
  }

  const requestJson = tryParseJson(requestBody);
  const responseJson = tryParseJson(responseBody);
  return {
    Successful: requestJson.Entries.map(({ Id, MessageBody }, idx) => ({
      Id,
      MessageId: responseJson?.Successful?.[idx]?.MessageId || crypto.randomUUID(),
      MD5OfMessageBody: crypto.createHash('md5').update(MessageBody).digest('hex')
    }))
  };
};

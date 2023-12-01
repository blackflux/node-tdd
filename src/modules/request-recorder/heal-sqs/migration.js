// This code logic is used to migrate legacy AWS SQS xml to json
import xml2js from 'xml2js';
import objectScan from 'object-scan';

const tryParseXML = (body) => {
  let parsed = body;
  try {
    xml2js.parseString(body, (err, result) => {
      parsed = JSON.parse(JSON.stringify(result));
    });
  } catch (e) {
    return null;
  }
  return parsed;
};

export default ({ responseBody, header }) => {
  const responseXml = tryParseXML(responseBody);
  if (responseXml !== null) {
    if (header === 'AmazonSQS.ListQueueTags') {
      const scanner = objectScan(['ListQueueTagsResponse.ListQueueTagsResult[0].Tag[*]'], {
        rtn: ({ value }) => [value.Key, value.Value[0]],
        afterFn: ({ result }) => Object.fromEntries(result)
      });
      const Tags = scanner(responseXml);
      return { Tags };
    }
    if (header === 'AmazonSQS.GetQueueAttributes') {
      const scanner = objectScan(['GetQueueAttributesResponse.GetQueueAttributesResult[0].Attribute[*]'], {
        rtn: ({ value }) => [value.Name[0], value.Value[0]],
        afterFn: ({ result }) => Object.fromEntries(result)
      });
      const Attributes = scanner(responseXml);
      return { Attributes };
    }
    if (header === 'AmazonSQS.GetQueueUrl') {
      if (responseXml?.ErrorResponse?.Error?.[0]?.Code?.[0] === 'AWS.SimpleQueueService.NonExistentQueue') {
        return {
          __type: 'com.amazonaws.sqs#QueueDoesNotExist',
          message: 'The specified queue does not exist.'
        };
      }
      const QueueUrl = responseXml?.GetQueueUrlResponse?.GetQueueUrlResult?.[0]?.QueueUrl?.[0];
      return { QueueUrl };
    }
    if (header === 'AmazonSQS.CreateQueue') {
      if (responseXml?.ErrorResponse?.Error?.[0]?.Code?.[0] === 'QueueAlreadyExists') {
        return {
          __type: 'com.amazonaws.sqs#QueueNameExists',
          message: 'The specified queue name does exist.'
        };
      }
      const QueueUrl = responseXml?.CreateQueueResponse?.CreateQueueResult?.[0]?.QueueUrl?.[0];
      return { QueueUrl };
    }
    if (header === 'AmazonSQS.ListQueues') {
      const scannerQueueUrls = objectScan(
        ['ListQueuesResponse.ListQueuesResult[0].QueueUrl[*]'],
        { rtn: 'value', reverse: false }
      );
      const scannerNextToken = objectScan(
        ['ListQueuesResponse.ListQueuesResult[0].NextToken[0]'],
        { rtn: 'value', reverse: false, abort: true }
      );
      return {
        QueueUrls: scannerQueueUrls(responseXml),
        NextToken: scannerNextToken(responseXml)
      };
    }
    if (header === 'AmazonSQS.TagQueue') {
      return {};
    }
    if (header === 'AmazonSQS.SetQueueAttributes') {
      return {};
    }
    if (header === 'AmazonSQS.SendMessageBatch') {
      const scannerSuccessful = objectScan(
        ['SendMessageBatchResponse.SendMessageBatchResult[0].SendMessageBatchResultEntry[*]'],
        {
          rtn: ({ value }) => ({
            Id: value.Id[0],
            MessageId: value.MessageId[0],
            MD5OfMessageBody: value.MD5OfMessageBody[0]
          }),
          reverse: false
        }
      );
      const scannerFailed = objectScan(
        ['SendMessageBatchResponse.SendMessageBatchResult[0].BatchResultErrorEntry[*]'],
        {
          rtn: ({ value }) => ({
            Id: value.Id[0],
            SenderFault: value.SenderFault[0],
            Code: value.Code[0]
          }),
          reverse: false
        }
      );
      return {
        Successful: scannerSuccessful(responseXml),
        Failed: scannerFailed(responseXml)
      };
    }
  }
  return responseBody;
};

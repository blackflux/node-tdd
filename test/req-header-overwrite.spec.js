import { expect } from 'chai';
import reqHeaderOverwrite from './req-header-overwrite.js';

describe('Testing req-header-overwrite.js', () => {
  it('Testing content-length zero', async () => {
    expect(reqHeaderOverwrite['content-length']({ value: 0 })).to.equal(0);
  });

  it('Testing content-length not zero', async () => {
    expect(reqHeaderOverwrite['content-length']({ value: 100 })).to.not.equal(0);
  });

  it('Testing user-agent by known host', async () => {
    expect(reqHeaderOverwrite['user-agent']({
      value: 'Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.110 Safari/537.36',
      headers: {
        host: 'sqs.us-west-2.amazonaws.com'
      }
    })).to.equal('^aws-sdk-js/.+$');
  });

  it('Testing user-agent by unknown host', async () => {
    const value = (
      'Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.110 Safari/537.36'
    );
    expect(reqHeaderOverwrite['user-agent']({
      value,
      headers: {
        host: 'some.unknown.host'
      }
    })).to.equal(value);
  });

  it('Testing x-amz-content-sha256 as unsigned payload', async () => {
    expect(reqHeaderOverwrite['x-amz-content-sha256']({
      value: 'UNSIGNED-PAYLOAD',
      headers: {
        host: 's3.us-west-2.amazonaws.com'
      }
    })).to.equal('UNSIGNED-PAYLOAD');
  });

  it('Testing x-amz-content-sha256 as hash', async () => {
    expect(reqHeaderOverwrite['x-amz-content-sha256']({
      value: '5fd924625f6ab16a19cc9807c7c506ae1813490e4ba675f843d5a10e0baacdb8',
      headers: {
        host: 's3.us-west-2.amazonaws.com'
      }
    })).to.equal('^[a-f0-9]{64}$');
  });
});

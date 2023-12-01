const transform = (logic) => Object.fromEntries(Object.entries(logic)
  .map(([k, v]) => [k, (kwargs) => {
    if (typeof v === 'function') {
      return v(kwargs);
    }
    const { headers, value } = kwargs;
    const entries = Object.entries(v);
    for (let idx = 0; idx < entries.length; idx += 1) {
      const [hostMatcher, valueNew] = entries[idx];
      if (typeof headers.host === 'string' && headers.host.endsWith(hostMatcher)) {
        return typeof valueNew === 'function' ? valueNew(kwargs) : valueNew;
      }
    }
    return value;
  }]));

export default transform({
  'content-length': ({ value }) => (String(value) === '0' ? 0 : '^[1-9][0-9]*$'),
  'os-version': {
    'getintheloop-dev-test.chargebee.com': '^linux x64 .+$'
  },
  'lang-version': {
    'getintheloop-dev-test.chargebee.com': '^v[0-9]+\\.[0-9]+\\.[0-9]+$'
  },
  'user-agent': {
    'monitoring.us-west-2.amazonaws.com': '^aws-sdk-js/.+$',
    'lambda.us-west-2.amazonaws.com': '^aws-sdk-js/.+$',
    'sqs.us-west-2.amazonaws.com': '^aws-sdk-js/.+$',
    'ssm.us-west-2.amazonaws.com': '^aws-sdk-js/.+$',
    'dynamodb.us-west-2.amazonaws.com': '^aws-sdk-js/.+$',
    's3.us-west-2.amazonaws.com': '^aws-sdk-js/.+$',
    'execute-api.us-west-2.amazonaws.com': '^service-search via service-discovery-util/[0-9]+\\.[0-9]+\\.[0-9]+$',
    'getintheloop-dev-test.chargebee.com': '^Chargebee-NodeJs-Client v[0-9]+\\.[0-9]+\\.[0-9]+$'
  },
  'x-amz-user-agent': {
    'monitoring.us-west-2.amazonaws.com': '^aws-sdk-js/[0-9]+.[0-9]+.[0-9]+$',
    'lambda.us-west-2.amazonaws.com': '^aws-sdk-js/[0-9]+.[0-9]+.[0-9]+$',
    'sqs.us-west-2.amazonaws.com': '^aws-sdk-js/[0-9]+.[0-9]+.[0-9]+$',
    'ssm.us-west-2.amazonaws.com': '^aws-sdk-js/[0-9]+.[0-9]+.[0-9]+$',
    'dynamodb.us-west-2.amazonaws.com': '^aws-sdk-js/[0-9]+.[0-9]+.[0-9]+$',
    's3.us-west-2.amazonaws.com': '^aws-sdk-js/[0-9]+.[0-9]+.[0-9]+$'
  },
  'amz-sdk-invocation-id': {
    '.us-west-2.amazonaws.com': '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
  },
  authorization: {
    '.us-west-2.amazonaws.com': '^AWS4-HMAC-SHA256 Credential=.+$',
    'opensearch:9200': '^AWS4-HMAC-SHA256 Credential=.+$',
    'getintheloop-dev-test.chargebee.com': '^Basic .+$',
    'org.okta.com': '^(SSWS|Bearer) .+$',
    '': '<PLEASE-FILL-IN-REGEX-HERE>'
  },
  'x-amz-date': {
    '.us-west-2.amazonaws.com': '^[0-9]{8}T[0-9]{6}Z$'
  },
  'x-amz-security-token': {
    '.us-west-2.amazonaws.com': '^X{368}$'
  },
  'x-amz-content-sha256': {
    '.us-west-2.amazonaws.com': ({ value }) => (value === 'UNSIGNED-PAYLOAD' ? value : '^[a-f0-9]{64}$')
  }
});

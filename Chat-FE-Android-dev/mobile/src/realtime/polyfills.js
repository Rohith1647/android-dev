// React Native TextEncoder / TextDecoder polyfill
import 'text-encoding';

// Ensure global.TextEncoder and global.TextDecoder are defined
if (typeof global.TextEncoder === 'undefined') {
  const encoding = require('text-encoding');
  global.TextEncoder = encoding.TextEncoder;
  global.TextDecoder = encoding.TextDecoder;
}

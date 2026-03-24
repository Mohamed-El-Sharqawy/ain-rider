const jwt = require('jsonwebtoken');

const secret = process.env.JWT_SECRET || 'local_dev_secret_change_in_production';
const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI0NDBhODg4NS1kY2IxLTQ0YzYtODk4My0xZTg2Y2E4YWI3ZmYiLCJlbWFpbCI6ImFkbWluQGFpbnJpZGVyLmNvbSIsInJvbGUiOiJBRE1JTiIsInR5cGUiOiJhY2Nlc3MiLCJpYXQiOjE3NzQyNDQ4OTcsImV4cCI6MTc3NDI0NTc5N30.cPI7pE9GCBLFpSxj6n0em_2GtJRsjqQpBhONftLbPfY';

console.log('JWT_SECRET from env:', process.env.JWT_SECRET);
console.log('Secret being used:', secret);
console.log('');

try {
  const verified = jwt.verify(token, secret);
  console.log('✅ Verification successful:', verified);
} catch (error) {
  console.log('❌ Verification failed:', error.message);
  
  console.log('\nTrying with default secret...');
  try {
    const verified2 = jwt.verify(token, 'change-me-in-production');
    console.log('✅ Verified with default:', verified2);
  } catch (e) {
    console.log('❌ Failed with default:', e.message);
  }
}

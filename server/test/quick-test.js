/**
 * Quick test for the analyze-report endpoint
 */

const BASE_URL = 'http://localhost:8787';

async function test() {
  // 1. Login
  console.log('1. Logging in...');
  const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'test@example.com', password: 'password123' }),
  });
  const loginData = await loginRes.json();
  const token = loginData.token;
  console.log('   Token received:', token ? 'Yes' : 'No');

  // 2. Test single report analysis
  console.log('\n2. Testing /api/ai/analyze-report...');
  const reportText = `URGENT: Fire broke out in slum area near Rajkot. 50 homes destroyed. People need immediate shelter, food, and medical help for burn victims. Around 300 people affected.`;

  const analyzeRes = await fetch(`${BASE_URL}/api/ai/analyze-report`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ reportText }),
  });
  const analyzeData = await analyzeRes.json();
  console.log('   Status:', analyzeRes.status);
  console.log('   Response:', JSON.stringify(analyzeData, null, 2));

  // 3. Test batch analysis
  console.log('\n3. Testing /api/ai/analyze-reports-batch...');
  const batchRes = await fetch(`${BASE_URL}/api/ai/analyze-reports-batch`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({
      reports: [
        {
          id: 'report-001',
          text: 'Field visit to village near Patan. People starving, no food for 3 days. Kids sick. Need doctor ASAP. 200 people living in tents. No clean water.',
        },
        {
          id: 'report-002',
          text: 'Community feedback from Gandhinagar Sector 12. Residents request park improvements - better lighting and seating. Non-urgent development request.',
        },
      ],
    }),
  });
  const batchData = await batchRes.json();
  console.log('   Status:', batchRes.status);
  console.log('   Total:', batchData.total);
  console.log('   Successful:', batchData.successful);
  console.log('   Failed:', batchData.failed);
  console.log('   Results:');
  batchData.results.forEach(r => {
    console.log(`     ${r.id}:`, r.error ? `Error: ${r.error}` : JSON.stringify(r.result, null, 2).substring(0, 100) + '...');
  });

  // 4. Test error handling - empty text
  console.log('\n4. Testing error handling (empty text)...');
  const errorRes = await fetch(`${BASE_URL}/api/ai/analyze-report`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ reportText: '' }),
  });
  const errorData = await errorRes.json();
  console.log('   Status:', errorRes.status);
  console.log('   Response:', JSON.stringify(errorData, null, 2));

  console.log('\n✅ All tests completed!');
}

test().catch(err => {
  console.error('Test failed:', err.message);
  process.exit(1);
});

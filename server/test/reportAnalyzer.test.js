/**
 * Test cases for Report Analyzer
 * Run with: node test/reportAnalyzer.test.js
 */

import { analyzeReport, analyzeReportsBatch } from '../services/reportAnalyzer.js';

// Sample test inputs
const testCases = [
  {
    name: 'Flood relief report',
    input: `Field Report - Gujarat Flood Relief
Date: 15th July 2024
Location: Village of Kheralu, Mehsana District

Situation Overview:
Heavy rainfall has caused severe flooding in the Kheralu area. Water levels have risen to 4-5 feet in some areas. 250 families have been displaced from their homes and are currently sheltering in the local school building. 

Immediate Needs:
- Food supplies running low - only 2 days of rations remaining
- Medical camp needed - several cases of waterborne diseases reported
- Clean drinking water urgently required
- Blankets and clothing for displaced families
- Temporary shelter materials needed

Affected Population:
Approximately 1,200 people affected including 400 children. 3 injuries reported, no casualties.

Contact: Ramesh Patel, Local Coordinator`,
    expectedNeeds: ['food', 'medical', 'shelter', 'water', 'clothing'],
    expectedUrgency: 'high',
  },
  {
    name: 'Medical camp survey',
    input: `Community Health Survey - Dang District
Conducted by: NGO HealthFirst

We visited 3 villages in Dang district last week. Primary health issues identified:
- Malnutrition in children under 5 (estimated 45 cases)
- Respiratory infections due to cold weather
- Lack of basic medicines at local PHC
- Pregnant women need prenatal care

Villages surveyed: Ahwa, Saputara, and Waghai
Total population surveyed: 850 people

Recommendations:
Mobile medical camp needed. Vitamin supplements required. Health education programs would be beneficial.`,
    expectedNeeds: ['medical', 'food'],
    expectedUrgency: 'medium',
  },
  {
    name: 'Short urgent message',
    input: `URGENT: Fire broke out in slum area near Rajkot. 50 homes destroyed. People need immediate shelter, food, and medical help for burn victims. Around 300 people affected.`,
    expectedNeeds: ['shelter', 'food', 'medical'],
    expectedUrgency: 'high',
  },
  {
    name: 'Infrastructure report',
    input: `Development Report - Kutch District

Road connectivity to 5 remote villages has been severely damaged due to recent heavy rains. Villagers are unable to access the main market and hospital. School buses cannot operate.

Villages affected: Bhujodi, Dumaro, and surrounding hamlets
Population affected: ~600 people

Needs:
- Road repair and restoration
- Temporary transport arrangement
- Communication equipment for coordination`,
    expectedNeeds: ['transport', 'communication'],
    expectedUrgency: 'medium',
  },
  {
    name: 'Low priority improvement',
    input: `Community Feedback - Gandhinagar

Residents of Sector 12 have requested improvement in the local park facilities. They would like better lighting and seating arrangements. This is part of the ongoing community development initiative.

No urgent issues reported.`,
    expectedNeeds: ['electricity'],
    expectedUrgency: 'low',
  },
  {
    name: 'Messy informal text',
    input: `hey we went to this village near patan... ppl there r starving no food for 3 days... kids r sick need doctor asap... like 200 ppl living in tents... no clean water... plz send help!!!`,
    expectedNeeds: ['food', 'medical', 'shelter', 'water'],
    expectedUrgency: 'high',
  },
];

// Run tests
async function runTests() {
  console.log('='.repeat(60));
  console.log('Report Analyzer Test Suite');
  console.log('='.repeat(60));
  console.log();

  let passed = 0;
  let failed = 0;

  for (const testCase of testCases) {
    console.log(`\nTest: ${testCase.name}`);
    console.log('-'.repeat(40));

    try {
      const result = await analyzeReport(testCase.input);

      console.log('Input preview:', testCase.input.substring(0, 80) + '...');
      console.log('Output:', JSON.stringify(result, null, 2));

      // Validate structure
      const requiredFields = ['location', 'urgency_level', 'needs', 'affected_people_estimate', 'summary'];
      const missingFields = requiredFields.filter(f => !(f in result));

      if (missingFields.length > 0) {
        console.log('❌ FAIL: Missing fields:', missingFields);
        failed++;
        continue;
      }

      // Validate urgency level
      if (!['low', 'medium', 'high'].includes(result.urgency_level)) {
        console.log('❌ FAIL: Invalid urgency_level:', result.urgency_level);
        failed++;
        continue;
      }

      // Validate needs is array
      if (!Array.isArray(result.needs)) {
        console.log('❌ FAIL: needs is not an array');
        failed++;
        continue;
      }

      // Check expected needs (at least some should match)
      if (testCase.expectedNeeds) {
        const matchedNeeds = testCase.expectedNeeds.filter(n => result.needs.includes(n));
        const matchRatio = matchedNeeds.length / testCase.expectedNeeds.length;

        if (matchRatio < 0.5) {
          console.log(`⚠️  WARNING: Only ${matchedNeeds.length}/${testCase.expectedNeeds.length} expected needs found`);
          console.log('   Expected:', testCase.expectedNeeds);
          console.log('   Got:', result.needs);
        } else {
          console.log(`✅ Needs match: ${matchedNeeds.length}/${testCase.expectedNeeds.length}`);
        }
      }

      // Check urgency
      if (testCase.expectedUrgency && result.urgency_level !== testCase.expectedUrgency) {
        console.log(`⚠️  WARNING: Expected urgency "${testCase.expectedUrgency}", got "${result.urgency_level}"`);
      } else if (testCase.expectedUrgency) {
        console.log(`✅ Urgency correct: ${result.urgency_level}`);
      }

      console.log('✅ PASS');
      passed++;
    } catch (error) {
      console.log('❌ FAIL:', error.message);
      failed++;
    }
  }

  // Test batch processing
  console.log('\n' + '='.repeat(60));
  console.log('Batch Processing Test');
  console.log('='.repeat(60));

  try {
    const batchInput = testCases.slice(0, 3).map((tc, i) => ({
      id: `report-${i + 1}`,
      text: tc.input,
    }));

    const batchResults = await analyzeReportsBatch(batchInput);

    const successful = batchResults.filter(r => r.error === null).length;
    const failed = batchResults.filter(r => r.error !== null).length;

    console.log(`Total: ${batchResults.length}`);
    console.log(`Successful: ${successful}`);
    console.log(`Failed: ${failed}`);

    if (successful === batchInput.length) {
      console.log('✅ Batch processing PASS');
      passed++;
    } else {
      console.log('❌ Batch processing FAIL');
      failed++;
    }
  } catch (error) {
    console.log('❌ Batch processing FAIL:', error.message);
    failed++;
  }

  // Test error handling
  console.log('\n' + '='.repeat(60));
  console.log('Error Handling Tests');
  console.log('='.repeat(60));

  // Empty text
  try {
    await analyzeReport('');
    console.log('❌ Empty text: Should have thrown error');
    failed++;
  } catch (e) {
    console.log('✅ Empty text: Correctly throws error');
    passed++;
  }

  // Non-string input
  try {
    await analyzeReport(null);
    console.log('❌ Null input: Should have thrown error');
    failed++;
  } catch (e) {
    console.log('✅ Null input: Correctly throws error');
    passed++;
  }

  // Very long text
  try {
    const longText = 'a'.repeat(60000);
    await analyzeReport(longText);
    console.log('❌ Long text: Should have thrown error');
    failed++;
  } catch (e) {
    console.log('✅ Long text: Correctly throws error');
    passed++;
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log(`Test Results: ${passed} passed, ${failed} failed`);
  console.log('='.repeat(60));

  process.exit(failed > 0 ? 1 : 0);
}

runTests();

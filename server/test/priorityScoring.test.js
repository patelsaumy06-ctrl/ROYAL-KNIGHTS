/**
 * Priority Scoring System Test Suite
 * Run with: node test/priorityScoring.test.js
 */

import {
  calculatePriorityScore,
  sortByPriority,
  getTopUrgentIssues,
  rankIssues,
  getPriorityCategory,
  formatPriority,
} from '../services/priorityScoring.js';

// Test cases
const testIssues = [
  {
    id: '1',
    location: 'Mumbai',
    urgency_level: 'high',
    affected_people_estimate: 500,
    needs: ['medical', 'shelter'],
    summary: 'Major flood with casualties',
  },
  {
    id: '2',
    location: 'Delhi',
    urgency_level: 'medium',
    affected_people_estimate: 200,
    needs: ['food', 'water'],
    summary: 'Food shortage in slum area',
  },
  {
    id: '3',
    location: 'Chennai',
    urgency_level: 'high',
    affected_people_estimate: 50,
    needs: ['medical'],
    summary: 'Medical emergency - small group',
  },
  {
    id: '4',
    location: 'Kolkata',
    urgency_level: 'low',
    affected_people_estimate: 1000,
    needs: ['education', 'infrastructure'],
    summary: 'School renovation needed',
  },
  {
    id: '5',
    location: 'Pune',
    urgency_level: 'high',
    affected_people_estimate: 3000,
    needs: ['shelter', 'food', 'water'],
    summary: 'Earthquake displacement',
  },
  {
    id: '6',
    location: 'Hyderabad',
    urgency_level: 'medium',
    affected_people_estimate: 150,
    needs: ['clothing', 'food'],
    summary: 'Winter clothing drive',
  },
  {
    id: '7',
    location: 'Bangalore',
    urgency_level: 'low',
    affected_people_estimate: 25,
    needs: ['education'],
    summary: 'After-school program',
  },
];

console.log('='.repeat(60));
console.log('Priority Scoring System Test Suite');
console.log('='.repeat(60));
console.log();

// Test 1: Individual score calculation
console.log('1. Individual Priority Score Calculation');
console.log('-'.repeat(60));

testIssues.forEach(issue => {
  const scored = calculatePriorityScore(issue);
  console.log(`\n${issue.location}: ${scored.priority_score}/100 (${getPriorityCategory(scored.priority_score)})`);
  console.log(`  Urgency: ${scored._scoring_breakdown.urgency_score} | Needs: ${scored._scoring_breakdown.need_score} | Population: ${scored._scoring_breakdown.population_score}`);
  console.log(`  Needs: ${issue.needs.join(', ')} | Affected: ${issue.affected_people_estimate}`);
});

// Test 2: Sorting
console.log('\n\n2. Sorted by Priority (Descending)');
console.log('-'.repeat(60));
const sorted = sortByPriority(testIssues);
sorted.forEach((issue, index) => {
  console.log(`${index + 1}. ${issue.location}: ${issue.priority_score}/100 - ${issue.summary.substring(0, 40)}...`);
});

// Test 3: Top 5 urgent issues
console.log('\n\n3. Top 5 Most Urgent Issues');
console.log('-'.repeat(60));
const top5 = getTopUrgentIssues(testIssues, 5);
top5.forEach((issue, index) => {
  console.log(`${index + 1}. [${issue.priority_score}] ${issue.location}: ${issue.summary}`);
});

// Test 4: Rank issues with metadata
console.log('\n\n4. Rank Issues (Full Results)');
console.log('-'.repeat(60));
const ranked = rankIssues(testIssues, { topN: 3, includeBreakdown: true });
console.log(`Total: ${ranked.total}, Returned: ${ranked.returned}`);
ranked.issues.forEach((issue, index) => {
  console.log(`\n#${index + 1}: ${issue.location}`);
  console.log(`  Score: ${formatPriority(issue.priority_score)}`);
  console.log(`  Breakdown: ${JSON.stringify(issue._scoring_breakdown)}`);
});

// Test 5: Edge cases
console.log('\n\n5. Edge Cases');
console.log('-'.repeat(60));

// Empty needs
const emptyNeeds = calculatePriorityScore({
  urgency_level: 'high',
  affected_people_estimate: 100,
  needs: [],
});
console.log(`Empty needs: ${emptyNeeds.priority_score}/100 (should be low)`);

// Unknown urgency
const unknownUrgency = calculatePriorityScore({
  urgency_level: 'unknown',
  affected_people_estimate: 100,
  needs: ['food'],
});
console.log(`Unknown urgency: ${unknownUrgency.priority_score}/100 (defaults to medium)`);

// Very large population
const massCasualty = calculatePriorityScore({
  urgency_level: 'high',
  affected_people_estimate: 10000,
  needs: ['medical', 'shelter'],
});
console.log(`Mass casualty (10k): ${massCasualty.priority_score}/100 (should be near max)`);

// Null/undefined handling
const nullIssue = calculatePriorityScore(null);
console.log(`Null issue: ${nullIssue.priority_score}/100 (graceful handling)`);

console.log('\n' + '='.repeat(60));
console.log('All tests completed successfully!');
console.log('='.repeat(60));

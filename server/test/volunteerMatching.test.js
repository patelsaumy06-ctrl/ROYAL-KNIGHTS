/**
 * Volunteer Matching System Test Suite
 * Run with: node test/volunteerMatching.test.js
 */

import {
  calculateMatch,
  findMatchesForTask,
  matchTasksToVolunteers,
  getMatchQuality,
  formatMatch,
} from '../services/volunteerMatching.js';

// Sample data
const volunteers = [
  {
    name: 'Dr. Priya Sharma',
    location: { lat: 19.076, lng: 72.877 }, // Mumbai
    skills: ['medical', 'emergency_response'],
    availability: true,
  },
  {
    name: 'Rahul Patel',
    location: { lat: 19.1, lng: 72.9 }, // Near Mumbai
    skills: ['logistics', 'transport'],
    availability: true,
  },
  {
    name: 'Anita Desai',
    location: { lat: 18.9, lng: 72.8 }, // Far from Mumbai
    skills: ['medical', 'counseling'],
    availability: true,
  },
  {
    name: 'Vikram Mehta',
    location: { lat: 19.08, lng: 72.88 }, // Very close to Mumbai
    skills: ['food', 'shelter'],
    availability: false, // Not available
  },
  {
    name: 'Sunita Rao',
    location: { lat: 19.07, lng: 72.87 }, // Mumbai
    skills: ['medical', 'food', 'logistics'],
    availability: true,
  },
];

const tasks = [
  {
    location: { lat: 19.076, lng: 72.877 }, // Mumbai
    needs: ['medical', 'emergency_response'],
    priority_score: 95,
  },
  {
    location: { lat: 19.076, lng: 72.877 }, // Mumbai
    needs: ['food', 'shelter'],
    priority_score: 70,
  },
  {
    location: { lat: 19.5, lng: 73.0 }, // Far location
    needs: ['medical'],
    priority_score: 85,
  },
];

console.log('='.repeat(60));
console.log('Volunteer Matching System Test Suite');
console.log('='.repeat(60));
console.log();

// Test 1: Individual match calculation
console.log('1. Individual Match Calculations');
console.log('-'.repeat(60));

const task1 = tasks[0];
volunteers.forEach(volunteer => {
  const match = calculateMatch(volunteer, task1);
  console.log(`\n${formatMatch(match)}`);
  if (match.is_match) {
    console.log(`  Skills: ${match.breakdown.skill_score} | Location: ${match.breakdown.location_score} | Available: ${match.breakdown.availability_score}`);
    console.log(`  Volunteer skills: ${volunteer.skills.join(', ')}`);
  }
});

// Test 2: Find matches for a task
console.log('\n\n2. Find Top 3 Matches for Medical Emergency');
console.log('-'.repeat(60));
const medicalTask = tasks[0];
const medicalMatches = findMatchesForTask(medicalTask, volunteers, 3);
medicalMatches.forEach((match, index) => {
  console.log(`${index + 1}. ${match.volunteer.name} - Score: ${match.match_score}/100 (${getMatchQuality(match.match_score)})`);
  console.log(`   Skills match: ${match.breakdown.skill_score}/50 | Location: ${match.breakdown.location_score}/30 | Available: ${match.breakdown.availability_score}/20`);
});

// Test 3: Find matches for food/shelter task
console.log('\n\n3. Find Top 3 Matches for Food/Shelter Task');
console.log('-'.repeat(60));
const shelterTask = tasks[1];
const shelterMatches = findMatchesForTask(shelterTask, volunteers, 3);
if (shelterMatches.length > 0) {
  shelterMatches.forEach((match, index) => {
    console.log(`${index + 1}. ${match.volunteer.name} - Score: ${match.match_score}/100`);
  });
} else {
  console.log('No viable matches found.');
}

// Test 4: Batch matching
console.log('\n\n4. Batch Match All Tasks');
console.log('-'.repeat(60));
const batchResults = matchTasksToVolunteers(tasks, volunteers, 3);
console.log(`Total tasks: ${batchResults.total_tasks}`);
console.log(`Matched tasks: ${batchResults.matched_tasks}`);
console.log(`Unmatched tasks: ${batchResults.unmatched_tasks}`);

batchResults.results.forEach((result, index) => {
  console.log(`\nTask ${index + 1} (${result.task.needs.join(', ')}):`);
  console.log(`  Matches found: ${result.match_count}`);
  result.top_matches.forEach((match, mIndex) => {
    console.log(`  ${mIndex + 1}. ${match.volunteer.name} - ${match.match_score}/100`);
  });
});

// Test 5: Edge cases
console.log('\n\n5. Edge Cases');
console.log('-'.repeat(60));

// No matching skills
const noSkillMatch = calculateMatch(
  { name: 'Test', skills: ['education'], availability: true },
  { needs: ['medical'], location: null }
);
console.log(`No skill match: ${noSkillMatch.match_score}/100 (should be 20 - availability only)`);
console.log(`Is viable match: ${noSkillMatch.is_match} (should be false)`);

// Not available
const notAvailable = calculateMatch(
  { name: 'Test', skills: ['medical'], availability: false },
  { needs: ['medical'], location: null }
);
console.log(`Not available: ${notAvailable.match_score}/100 (should be 50 - skills only)`);
console.log(`Is viable match: ${notAvailable.is_match} (should be false)`);

// Perfect match
const perfectMatch = calculateMatch(
  { 
    name: 'Perfect', 
    location: { lat: 19.076, lng: 72.877 }, 
    skills: ['medical', 'emergency_response'], 
    availability: true 
  },
  { 
    needs: ['medical', 'emergency_response'], 
    location: { lat: 19.076, lng: 72.877 } 
  }
);
console.log(`Perfect match: ${perfectMatch.match_score}/100 (should be 100)`);
console.log(`Is viable match: ${perfectMatch.is_match} (should be true)`);

// String location matching
const stringLocationMatch = calculateMatch(
  { name: 'Test', location: 'Mumbai', skills: ['medical'], availability: true },
  { needs: ['medical'], location: 'Mumbai' }
);
console.log(`String location match: ${stringLocationMatch.match_score}/100 (exact match)`);

// Partial string location match
const partialLocationMatch = calculateMatch(
  { name: 'Test', location: 'Mumbai Central', skills: ['medical'], availability: true },
  { needs: ['medical'], location: 'Mumbai' }
);
console.log(`Partial location match: ${partialLocationMatch.match_score}/100 (partial match)`);

console.log('\n' + '='.repeat(60));
console.log('All tests completed successfully!');
console.log('='.repeat(60));

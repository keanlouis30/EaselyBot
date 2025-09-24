require('dotenv').config();

// Copy the improved timezone functions from index.js for testing

// Build a Date that represents a specific local time in Manila (UTC+08:00)
function buildManilaDateFromParts({ year, month, day, hour = 17, minute = 0 }) {
  const y = String(year).padStart(4, '0');
  const m = String(month).padStart(2, '0');
  const d = String(day).padStart(2, '0');
  const hh = String(hour).padStart(2, '0');
  const mm = String(minute).padStart(2, '0');
  // Use explicit +08:00 offset to avoid relying on host timezone
  return new Date(`${y}-${m}-${d}T${hh}:${mm}:00+08:00`);
}

// Helper function to get current date/time in Manila timezone
function getManilaDate(date = new Date()) {
  // Get the current Manila time using proper timezone conversion
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
  
  const parts = formatter.formatToParts(date);
  const year = parseInt(parts.find(p => p.type === 'year').value);
  const month = parseInt(parts.find(p => p.type === 'month').value);
  const day = parseInt(parts.find(p => p.type === 'day').value);
  const hour = parseInt(parts.find(p => p.type === 'hour').value);
  const minute = parseInt(parts.find(p => p.type === 'minute').value);
  const second = parseInt(parts.find(p => p.type === 'second').value);
  
  // Create a proper Manila time Date object
  return buildManilaDateFromParts({ year, month, day, hour, minute });
}

// Combine date and time into a single Date object (using Manila timezone)
function combineDateAndTime(dateObj, timeObj) {
  // Extract date parts in Manila timezone using Intl.DateTimeFormat
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  
  const parts = formatter.formatToParts(dateObj);
  const year = parseInt(parts.find(p => p.type === 'year').value);
  const month = parseInt(parts.find(p => p.type === 'month').value);
  const day = parseInt(parts.find(p => p.type === 'day').value);
  
  return buildManilaDateFromParts({
    year,
    month,
    day,
    hour: timeObj.hour,
    minute: timeObj.minute
  });
}

function formatDateTimeManila(date) {
  return date.toLocaleString('en-US', {
    timeZone: 'Asia/Manila',
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
}

// Helper function to extract Manila date components
const getManilaDateParts = (date) => {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  const parts = formatter.formatToParts(date);
  return {
    year: parseInt(parts.find(p => p.type === 'year').value),
    month: parseInt(parts.find(p => p.type === 'month').value),
    day: parseInt(parts.find(p => p.type === 'day').value)
  };
};

function testManilaTimezone() {
  console.log('🧪 Testing Manila Timezone Handling\n');
  
  // Test current time
  const now = new Date();
  const manilaDate = getManilaDate(now);
  
  console.log('📅 Current Times:');
  console.log(`   UTC: ${now.toISOString()}`);
  console.log(`   Manila (raw): ${now.toLocaleString('en-US', { timeZone: 'Asia/Manila' })}`);
  console.log(`   Manila (processed): ${manilaDate.toISOString()}`);
  console.log(`   Manila (formatted): ${formatDateTimeManila(manilaDate)}`);
  console.log('');
  
  // Test "today" date creation
  console.log('📆 Testing "Today" Date Creation:');
  const todayParts = getManilaDateParts(new Date());
  console.log(`   Manila date parts:`, todayParts);
  
  const todayTaskDate = buildManilaDateFromParts({
    year: todayParts.year,
    month: todayParts.month,
    day: todayParts.day,
    hour: 0,
    minute: 0
  });
  
  console.log(`   Today task date: ${todayTaskDate.toISOString()}`);
  console.log(`   Today formatted: ${formatDateTimeManila(todayTaskDate)}`);
  console.log('');
  
  // Test combining date and time (like selecting 11:59 PM)
  console.log('🕚 Testing Date + Time Combination (11:59 PM):');
  const finalDateTime = combineDateAndTime(todayTaskDate, { hour: 23, minute: 59 });
  console.log(`   Combined: ${finalDateTime.toISOString()}`);
  console.log(`   Combined formatted: ${formatDateTimeManila(finalDateTime)}`);
  console.log('');
  
  // Test with different dates to ensure consistency
  console.log('🔄 Testing Date Consistency:');
  const testDate = new Date('2025-09-24T00:00:00Z'); // Your example date
  const testParts = getManilaDateParts(testDate);
  console.log(`   Test date (UTC): ${testDate.toISOString()}`);
  console.log(`   Test date (Manila parts):`, testParts);
  
  const testTaskDate = buildManilaDateFromParts({
    year: testParts.year,
    month: testParts.month,
    day: testParts.day,
    hour: 23,
    minute: 59
  });
  console.log(`   Test task (11:59 PM Manila): ${testTaskDate.toISOString()}`);
  console.log(`   Test task formatted: ${formatDateTimeManila(testTaskDate)}`);
  
  // Verify that September 24 in Manila shows as September 24, not 23
  const sept24Manila = buildManilaDateFromParts({
    year: 2025,
    month: 9,
    day: 24,
    hour: 23,
    minute: 59
  });
  console.log('');
  console.log('✅ Expected Result for Sep 24, 2025 11:59 PM Manila:');
  console.log(`   ISO: ${sept24Manila.toISOString()}`);
  console.log(`   Formatted: ${formatDateTimeManila(sept24Manila)}`);
  console.log(`   Should show September 24, not 23!`);
}

if (require.main === module) {
  testManilaTimezone();
}

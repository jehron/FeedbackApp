/**
 * Simple error logger for Vercel with human-readable output
 */

export function logError(endpoint, error, context = {}) {
  const lines = [
    '',
    '═══ API ERROR ═══',
    `Endpoint: ${endpoint}`,
    `Error: ${error.message || 'Unknown error'}`,
    `Type: ${error.name || 'Error'}`,
  ];

  // Add context if provided
  const contextEntries = Object.entries(context);
  if (contextEntries.length > 0) {
    lines.push('Context:');
    for (const [key, value] of contextEntries) {
      lines.push(`  - ${key}: ${value}`);
    }
  }

  // Add truncated stack trace (first 5 lines)
  if (error.stack) {
    const stackLines = error.stack.split('\n').slice(0, 5).join('\n');
    lines.push('Stack:');
    lines.push(stackLines);
  }

  lines.push('═════════════════');
  lines.push('');

  console.error(lines.join('\n'));
}

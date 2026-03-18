const suspiciousPatterns: RegExp[] = [
  /ignore previous instructions/i,
  /system prompt/i,
  /developer instructions/i,
  /exfiltrate/i,
  /override/i,
];

export function hasPromptInjection(content: string): boolean {
  return suspiciousPatterns.some((pattern) => pattern.test(content));
}

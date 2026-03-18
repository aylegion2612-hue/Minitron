export function isSenderAllowed(sender: string, allowFrom: string[]): boolean {
  if (allowFrom.length === 0) {
    return true;
  }
  return allowFrom.includes(sender);
}

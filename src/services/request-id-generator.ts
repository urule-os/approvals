// Sequential ID generator: REQ-YYYYMMDD-NNN
let counter = 0;
let lastDate = '';

export function generateRequestId(): string {
  const now = new Date();
  const date = now.toISOString().slice(0, 10).replace(/-/g, '');

  if (date !== lastDate) {
    counter = 0;
    lastDate = date;
  }

  counter++;
  return `REQ-${date}-${String(counter).padStart(3, '0')}`;
}

export function resetRequestIdGenerator(): void {
  counter = 0;
  lastDate = '';
}

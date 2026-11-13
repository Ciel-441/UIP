export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ');
}

export function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function formatDateTime(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return formatDate(dateString);
}

const PALETTE = [
  '#f43f5e', // rose
  '#ff79c6', // pink
  '#ff8feb', // fuchsia
  '#d68eff', // purple
  '#d68eff', // violet
  '#ff79c6', // indigo
  '#3b82f6', // blue
  '#0ea5e9', // sky
  '#06b6d4', // cyan
  '#14b8a6', // teal
  '#10b981', // emerald
  '#22c55e', // green
  '#84cc16', // lime
  '#eab308', // yellow
  '#f59e0b', // amber
  '#f97316', // orange
  '#ef4444', // red
];

export function getEntityColor(type: string): string {
  const predefined: Record<string, string> = {
    Plant: '#10b981',
    Animal: '#f59e0b',
    Disease: '#ef4444',
    Chemical: '#d68eff',
    Climate: '#06b6d4',
    Soil: '#d97706',
  };
  
  if (predefined[type]) return predefined[type];

  // Deterministic hash based on the type string
  let hash = 0;
  for (let i = 0; i < type.length; i++) {
    hash = type.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  const index = Math.abs(hash) % PALETTE.length;
  return PALETTE[index];
}

export function getEntityBgColor(type: string): string {
  const hex = getEntityColor(type);
  // hex is always a 7-character string like #f43f5e
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, 0.15)`;
}

export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength) + '...';
}

export function debounce<T extends (...args: any[]) => void>(fn: T, delay: number): T {
  let timer: NodeJS.Timeout;
  return ((...args: any[]) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  }) as T;
}

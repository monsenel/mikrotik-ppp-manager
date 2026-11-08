import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Parses a RouterOS uptime string (e.g. "2w3d14h25m10s", "4d05:12:09", "18h42m11s")
 * into total seconds for accurate sorting and comparison.
 */
export function parseRouterOsUptimeToSeconds(uptime?: string): number {
  if (!uptime || typeof uptime !== 'string') return 0;
  let total = 0;
  const weeks = uptime.match(/(\d+)w/);
  const days = uptime.match(/(\d+)d/);
  const hours = uptime.match(/(\d+)h/);
  const mins = uptime.match(/(\d+)m/);
  const secs = uptime.match(/(\d+)s/);

  if (weeks) total += parseInt(weeks[1], 10) * 7 * 86400;
  if (days) total += parseInt(days[1], 10) * 86400;
  if (hours) total += parseInt(hours[1], 10) * 3600;
  if (mins) total += parseInt(mins[1], 10) * 60;
  if (secs) total += parseInt(secs[1], 10);

  // Also support HH:MM:SS format if present
  const hms = uptime.match(/(\d{1,2}):(\d{2}):(\d{2})/);
  if (hms && !hours && !mins && !secs) {
    total +=
      parseInt(hms[1], 10) * 3600 +
      parseInt(hms[2], 10) * 60 +
      parseInt(hms[3], 10);
  }

  return total;
}

/**
 * Formats byte count into human-readable units (B, KiB, MiB, GiB, TiB).
 */
export function formatBytes(bytes?: number): string {
  if (!bytes || bytes <= 0) return 'Unlimited';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let val = bytes;
  let idx = 0;
  while (val >= 1024 && idx < units.length - 1) {
    val /= 1024;
    idx++;
  }
  return `${val % 1 === 0 ? val : val.toFixed(1)} ${units[idx]}`;
}

/**
 * RouterOS PPP Profile Rate-Limit Semantics:
 * In RouterOS `/ppp/profile`, `rate-limit` is formatted as:
 *   rx-rate[/tx-rate] [rx-burst-rate[/tx-burst-rate] [rx-burst-threshold[/tx-burst-threshold] [rx-burst-time[/tx-burst-time] [priority] [rx-rate-min[/tx-rate-min]]]]]
 *
 * CRITICAL MIKROTIK SEMANTICS:
 * `rx-rate` is traffic RECEIVED by the router interface from the PPP client = CLIENT UPLOAD.
 * `tx-rate` is traffic TRANSMITTED by the router interface to the PPP client = CLIENT DOWNLOAD.
 * Example: "2M/5M" means 2 Mbps Client Upload (Router RX) and 5 Mbps Client Download (Router TX).
 */
export interface ParsedRateLimit {
  uploadValue: string;
  uploadUnit: 'k' | 'M' | 'G';
  downloadValue: string;
  downloadUnit: 'k' | 'M' | 'G';
  rawExtra: string;
  isFormatted: boolean;
}

export function parseRouterOsRateLimit(rateLimit: string): ParsedRateLimit {
  const trimmed = (rateLimit || '').trim();
  if (!trimmed) {
    return {
      uploadValue: '',
      uploadUnit: 'M',
      downloadValue: '',
      downloadUnit: 'M',
      rawExtra: '',
      isFormatted: true,
    };
  }

  const parts = trimmed.split(/\s+/);
  const basePair = parts[0] || '';
  const rawExtra = parts.slice(1).join(' ');

  const match = basePair.match(/^(\d+(?:\.\d+)?)([kMG]?)\/(\d+(?:\.\d+)?)([kMG]?)$/i);
  if (!match) {
    return {
      uploadValue: '',
      uploadUnit: 'M',
      downloadValue: '',
      downloadUnit: 'M',
      rawExtra: trimmed,
      isFormatted: false,
    };
  }

  const normalizeUnit = (u: string): 'k' | 'M' | 'G' => {
    if (u.toLowerCase() === 'k') return 'k';
    if (u.toUpperCase() === 'G') return 'G';
    return 'M';
  };

  return {
    uploadValue: match[1],
    uploadUnit: normalizeUnit(match[2] || 'M'),
    downloadValue: match[3],
    downloadUnit: normalizeUnit(match[4] || 'M'),
    rawExtra,
    isFormatted: true,
  };
}

export function formatRouterOsRateLimit(
  uploadValue: string,
  uploadUnit: 'k' | 'M' | 'G',
  downloadValue: string,
  downloadUnit: 'k' | 'M' | 'G',
  rawExtra?: string
): string {
  const up = uploadValue.trim();
  const down = downloadValue.trim();
  if (!up || !down) return '';
  const base = `${up}${uploadUnit}/${down}${downloadUnit}`;
  return rawExtra?.trim() ? `${base} ${rawExtra.trim()}` : base;
}

export function describeRateLimitHuman(rateLimit: string, lang: 'en' | 'fa' = 'en'): string {
  if (!rateLimit || !rateLimit.trim()) {
    return lang === 'fa' ? 'نامحدود (بدون محدودیت)' : 'Unlimited (Unthrottled)';
  }
  const parsed = parseRouterOsRateLimit(rateLimit);
  if (!parsed.isFormatted || !parsed.uploadValue || !parsed.downloadValue) {
    return rateLimit;
  }
  const unitLabel = (u: 'k' | 'M' | 'G') =>
    u === 'k' ? 'Kbps' : u === 'G' ? 'Gbps' : 'Mbps';

  if (lang === 'fa') {
    return `${parsed.downloadValue} ${unitLabel(parsed.downloadUnit)} دانلود / ${parsed.uploadValue} ${unitLabel(parsed.uploadUnit)} آپلود`;
  }
  return `${parsed.downloadValue} ${unitLabel(parsed.downloadUnit)} Down / ${parsed.uploadValue} ${unitLabel(parsed.uploadUnit)} Up`;
}

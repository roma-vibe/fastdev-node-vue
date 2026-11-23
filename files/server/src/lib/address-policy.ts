import { isIPv4, isIPv6 } from 'node:net';

/**
 * What an IP address is, for outbound requests (lib/outbound.ts). Only `public` addresses may be
 * connected to; every other kind can reach this machine, the local network or the cloud metadata
 * service (169.254.169.254), which is what SSRF attacks are after.
 */
export type AddressKind =
  | 'public'
  /** 0.0.0.0/8, :: */
  | 'unspecified'
  /** 127.0.0.0/8, ::1 */
  | 'loopback'
  /** 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16, unique-local fc00::/7 */
  | 'private'
  /** 100.64.0.0/10, carrier-grade NAT */
  | 'shared'
  /** 169.254.0.0/16, fe80::/10 */
  | 'link-local'
  /** 224.0.0.0/4, ff00::/8 */
  | 'multicast'
  /** 255.255.255.255 */
  | 'broadcast'
  /**
   * Documentation, benchmarking and future-use ranges; relays and tunnels that lead to other
   * networks (6to4 relay 192.88.99.0/24, Teredo 2001::/32); ORCHID identifiers (2001:10::/28,
   * 2001:20::/28); IPv6 documentation 2001:db8::/32 and 3fff::/20; IPv6 outside global unicast
   * 2000::/3
   */
  | 'reserved'
  /** Not an IP address. */
  | 'invalid';

/** Non-public IPv4 ranges: [network, prefix length, kind]. The first match wins. */
const IPV4_RANGES: readonly (readonly [string, number, AddressKind])[] = [
  ['0.0.0.0', 8, 'unspecified'],
  ['10.0.0.0', 8, 'private'],
  ['100.64.0.0', 10, 'shared'],
  ['127.0.0.0', 8, 'loopback'],
  ['169.254.0.0', 16, 'link-local'],
  ['172.16.0.0', 12, 'private'],
  ['192.0.0.0', 24, 'reserved'],
  ['192.0.2.0', 24, 'reserved'],
  ['192.88.99.0', 24, 'reserved'],
  ['192.168.0.0', 16, 'private'],
  ['198.18.0.0', 15, 'reserved'],
  ['198.51.100.0', 24, 'reserved'],
  ['203.0.113.0', 24, 'reserved'],
  ['224.0.0.0', 4, 'multicast'],
  ['255.255.255.255', 32, 'broadcast'],
  ['240.0.0.0', 4, 'reserved'],
];

/** Classifies an IPv4 or IPv6 address (brackets and a zone id such as %en0 are allowed). */
export function classifyAddress(address: string): AddressKind {
  const ip = address.replace(/^\[(.*)\]$/, '$1').replace(/%.*$/, '');
  if (isIPv4(ip)) return classifyIPv4(ipv4ToNumber(ip));
  if (isIPv6(ip)) return classifyIPv6(ipv6ToWords(ip));
  return 'invalid';
}

/** True only for addresses that outbound requests may connect to. */
export function isPublicAddress(address: string): boolean {
  return classifyAddress(address) === 'public';
}

function classifyIPv4(value: number): AddressKind {
  for (const [network, bits, kind] of IPV4_RANGES) {
    const size = 2 ** (32 - bits);
    if (Math.floor(value / size) === Math.floor(ipv4ToNumber(network) / size)) return kind;
  }
  return 'public';
}

function classifyIPv6(words: readonly number[]): AddressKind {
  const [w0 = 0, w1 = 0, w2 = 0, w3 = 0, w4 = 0, w5 = 0, w6 = 0, w7 = 0] = words;
  const zeroUpTo5 = w0 === 0 && w1 === 0 && w2 === 0 && w3 === 0 && w4 === 0;
  const embeddedIPv4 = w6 * 0x1_0000 + w7;

  if (zeroUpTo5 && w5 === 0 && w6 === 0 && w7 === 0) return 'unspecified';
  if (zeroUpTo5 && w5 === 0 && w6 === 0 && w7 === 1) return 'loopback';
  // IPv4-mapped (::ffff:a.b.c.d) and IPv4-compatible (::a.b.c.d) forms: judge the IPv4 address.
  if (zeroUpTo5 && (w5 === 0xffff || w5 === 0)) return classifyIPv4(embeddedIPv4);
  // NAT64 (64:ff9b::a.b.c.d) and 6to4 (2002:aabb:ccdd::) also reach an IPv4 address.
  if (w0 === 0x64 && w1 === 0xff9b && w2 === 0 && w3 === 0 && w4 === 0 && w5 === 0) {
    return classifyIPv4(embeddedIPv4);
  }
  if (w0 === 0x2002) return classifyIPv4(w1 * 0x1_0000 + w2);

  if ((w0 & 0xfe00) === 0xfc00) return 'private';
  if ((w0 & 0xffc0) === 0xfe80) return 'link-local';
  if ((w0 & 0xff00) === 0xff00) return 'multicast';
  if (w0 === 0x2001 && w1 === 0x0000) return 'reserved'; // Teredo 2001::/32
  if (w0 === 0x2001 && ((w1 & 0xfff0) === 0x0010 || (w1 & 0xfff0) === 0x0020)) return 'reserved'; // ORCHID
  if (w0 === 0x2001 && w1 === 0x0db8) return 'reserved';
  if (w0 === 0x3fff && (w1 & 0xf000) === 0) return 'reserved'; // documentation 3fff::/20
  // Only global unicast (2000::/3) is public.
  return (w0 & 0xe000) === 0x2000 ? 'public' : 'reserved';
}

function ipv4ToNumber(ip: string): number {
  return ip.split('.').reduce((value, octet) => value * 256 + Number(octet), 0);
}

/** The eight 16-bit words of a valid IPv6 address, with `::` expanded. */
function ipv6ToWords(ip: string): number[] {
  let text = ip;
  // A dotted IPv4 tail (::ffff:127.0.0.1) becomes two hex words.
  const tailStart = text.lastIndexOf(':') + 1;
  const tail = text.slice(tailStart);
  if (tail.includes('.')) {
    const value = ipv4ToNumber(tail);
    text = `${text.slice(0, tailStart)}${Math.floor(value / 0x1_0000).toString(16)}:${(value % 0x1_0000).toString(16)}`;
  }
  const [head = '', rest] = text.split('::');
  const left = head ? head.split(':') : [];
  const right = rest ? rest.split(':') : [];
  const gap = rest === undefined ? [] : Array<string>(8 - left.length - right.length).fill('0');
  return [...left, ...gap, ...right].map((word) => Number.parseInt(word, 16));
}

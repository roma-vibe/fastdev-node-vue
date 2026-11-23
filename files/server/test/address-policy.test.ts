import { describe, expect, it } from 'vitest';
import { classifyAddress, isPublicAddress } from '../src/lib/address-policy.ts';

describe('classifyAddress', () => {
  it.each([
    ['0.0.0.0', 'unspecified'],
    ['0.1.2.3', 'unspecified'],
    ['127.0.0.1', 'loopback'],
    ['127.255.255.254', 'loopback'],
    ['10.0.0.1', 'private'],
    ['172.16.0.1', 'private'],
    ['172.31.255.255', 'private'],
    ['192.168.1.1', 'private'],
    ['100.64.0.1', 'shared'],
    ['100.127.255.255', 'shared'],
    ['169.254.169.254', 'link-local'],
    ['224.0.0.1', 'multicast'],
    ['239.255.255.250', 'multicast'],
    ['255.255.255.255', 'broadcast'],
    ['240.0.0.1', 'reserved'],
    ['192.0.2.10', 'reserved'],
    ['192.88.99.1', 'reserved'],
  ])('IPv4 %s is %s', (address, kind) => {
    expect(classifyAddress(address)).toBe(kind);
  });

  it.each([
    ['::', 'unspecified'],
    ['::1', 'loopback'],
    ['[::1]', 'loopback'],
    ['fc00::1', 'private'],
    ['fd12:3456::1', 'private'],
    ['fe80::1', 'link-local'],
    ['fe80::1%en0', 'link-local'],
    ['ff02::1', 'multicast'],
    ['2001:db8::1', 'reserved'],
    ['100::1', 'reserved'],
    // Teredo, ORCHID (v1 and v2), documentation 3fff::/20
    ['2001::1', 'reserved'],
    ['2001:0:4136:e378:8000:63bf:3fff:fdd2', 'reserved'],
    ['2001:10::1', 'reserved'],
    ['2001:1f:ffff::1', 'reserved'],
    ['2001:20::1', 'reserved'],
    ['2001:2f:ffff::1', 'reserved'],
    ['3fff::1', 'reserved'],
    ['3fff:fff:ffff::1', 'reserved'],
  ])('IPv6 %s is %s', (address, kind) => {
    expect(classifyAddress(address)).toBe(kind);
  });

  it.each([
    // IPv4-mapped, dotted and hex forms
    ['::ffff:127.0.0.1', 'loopback'],
    ['::ffff:7f00:1', 'loopback'],
    ['0:0:0:0:0:ffff:7f00:0001', 'loopback'],
    ['::ffff:10.1.2.3', 'private'],
    ['::ffff:169.254.169.254', 'link-local'],
    ['::ffff:a9fe:a9fe', 'link-local'],
    ['::ffff:100.64.0.1', 'shared'],
    ['::ffff:0.0.0.0', 'unspecified'],
    ['::ffff:255.255.255.255', 'broadcast'],
    ['::ffff:224.0.0.1', 'multicast'],
    // IPv4-compatible
    ['::127.0.0.1', 'loopback'],
    ['::7f00:1', 'loopback'],
    ['::192.168.0.1', 'private'],
    // NAT64 and 6to4
    ['64:ff9b::127.0.0.1', 'loopback'],
    ['64:ff9b::a9fe:a9fe', 'link-local'],
    ['2002:7f00:1::', 'loopback'],
    ['2002:c0a8:101::1', 'private'],
  ])('embedded IPv4 %s is %s', (address, kind) => {
    expect(classifyAddress(address)).toBe(kind);
  });

  it('accepts public addresses only', () => {
    expect(isPublicAddress('93.184.215.14')).toBe(true);
    expect(isPublicAddress('8.8.8.8')).toBe(true);
    expect(isPublicAddress('2606:4700:4700::1111')).toBe(true);
    expect(isPublicAddress('::ffff:8.8.8.8')).toBe(true);
    expect(isPublicAddress('2002:808:808::')).toBe(true);
    expect(isPublicAddress('172.32.0.1')).toBe(true);
    expect(isPublicAddress('100.128.0.1')).toBe(true);
    expect(isPublicAddress('192.88.100.1')).toBe(true);
    expect(isPublicAddress('2001:4860:4860::8888')).toBe(true);
    expect(isPublicAddress('2001:200::1')).toBe(true);
  });

  it('rejects things that are not IP addresses', () => {
    expect(classifyAddress('localhost')).toBe('invalid');
    expect(classifyAddress('127.1')).toBe('invalid');
    expect(classifyAddress('')).toBe('invalid');
    expect(isPublicAddress('example.com')).toBe(false);
  });
});

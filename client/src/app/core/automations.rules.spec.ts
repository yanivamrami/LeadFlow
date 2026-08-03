import { webhookUrlCheck } from './automations.rules';

describe('webhookUrlCheck', () => {
  it('refuses an empty URL', () => {
    const verdict = webhookUrlCheck('');
    expect(typeof verdict === 'object' && verdict.refused).toBeTruthy();
  });

  it('refuses a string that is not a URL at all', () => {
    const verdict = webhookUrlCheck('not a url');
    expect(typeof verdict === 'object' && verdict.refused).toBeTruthy();
  });

  it('refuses plain http://', () => {
    const verdict = webhookUrlCheck('http://example.com/hook');
    expect(typeof verdict === 'object' && verdict.refused).toBeTruthy();
  });

  it('refuses localhost', () => {
    const verdict = webhookUrlCheck('https://localhost/hook');
    expect(typeof verdict === 'object' && verdict.refused).toBeTruthy();
  });

  it('refuses 127.0.0.1 (loopback)', () => {
    const verdict = webhookUrlCheck('https://127.0.0.1/hook');
    expect(typeof verdict === 'object' && verdict.refused).toBeTruthy();
  });

  it('refuses a 10.x private address', () => {
    const verdict = webhookUrlCheck('https://10.1.2.3/hook');
    expect(typeof verdict === 'object' && verdict.refused).toBeTruthy();
  });

  it('refuses a 192.168.x private address', () => {
    const verdict = webhookUrlCheck('https://192.168.0.5/hook');
    expect(typeof verdict === 'object' && verdict.refused).toBeTruthy();
  });

  it('refuses 172.16-31.x (the private range), and only that sub-range', () => {
    expect(typeof webhookUrlCheck('https://172.16.0.1/hook') === 'object').toBe(true);
    expect(typeof webhookUrlCheck('https://172.20.5.9/hook') === 'object').toBe(true);
    expect(typeof webhookUrlCheck('https://172.31.255.255/hook') === 'object').toBe(true);
    // 172.32.x and 172.15.x are outside the reserved block and are ordinary public space.
    expect(webhookUrlCheck('https://172.32.0.1/hook')).toBe('ok');
    expect(webhookUrlCheck('https://172.15.0.1/hook')).toBe('ok');
  });

  it('refuses the link-local metadata address 169.254.169.254', () => {
    const verdict = webhookUrlCheck('https://169.254.169.254/latest/meta-data/');
    expect(typeof verdict === 'object' && verdict.refused).toBeTruthy();
  });

  it('refuses 0.0.0.0', () => {
    const verdict = webhookUrlCheck('https://0.0.0.0/hook');
    expect(typeof verdict === 'object' && verdict.refused).toBeTruthy();
  });

  it('refuses the IPv6 loopback ::1', () => {
    const verdict = webhookUrlCheck('https://[::1]/hook');
    expect(typeof verdict === 'object' && verdict.refused).toBeTruthy();
  });

  it('allows an ordinary https:// host', () => {
    expect(webhookUrlCheck('https://api.example.com/webhooks/leadflow')).toBe('ok');
  });

  it('allows an ordinary https:// host with a port and query string', () => {
    expect(webhookUrlCheck('https://hooks.example.co.il:8443/in?token=abc')).toBe('ok');
  });

  it('trims surrounding whitespace before checking', () => {
    expect(webhookUrlCheck('  https://api.example.com/hook  ')).toBe('ok');
  });
});

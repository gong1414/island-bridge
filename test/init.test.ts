import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildConfig } from '../src/lib/init.js';

describe('buildConfig', () => {
  it('builds config from flags', () => {
    const config = buildConfig({
      host: 'example.com',
      user: 'deploy',
      paths: '/var/www/app,/etc/nginx/conf.d',
    });
    assert.equal(config.remote.host, 'example.com');
    assert.equal(config.remote.user, 'deploy');
    assert.deepStrictEqual(config.remote.paths, ['/var/www/app', '/etc/nginx/conf.d']);
  });

  it('includes exclude patterns when provided', () => {
    const config = buildConfig({
      host: 'h',
      user: 'u',
      paths: '/app',
      exclude: 'node_modules,*.log',
    });
    assert.deepStrictEqual(config.exclude, ['node_modules', '*.log']);
  });

  it('omits exclude when not provided', () => {
    const config = buildConfig({ host: 'h', user: 'u', paths: '/app' });
    assert.equal(config.exclude, undefined);
  });

  it('throws if host is missing', () => {
    assert.throws(() => buildConfig({ user: 'u', paths: '/app' }), /host.*required/i);
  });

  it('throws if user is missing', () => {
    assert.throws(() => buildConfig({ host: 'h', paths: '/app' }), /user.*required/i);
  });

  it('throws if paths is missing', () => {
    assert.throws(() => buildConfig({ host: 'h', user: 'u' }), /paths.*required/i);
  });
});

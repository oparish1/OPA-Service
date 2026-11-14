import { createHash } from 'node:crypto';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CAPABILITY_IDS } from '../src/core/authz/generated';
import {
  downloadRelease,
  latestTag,
  main,
  readVersion,
  verifyArtifacts,
  type CommandResult,
} from './sync-policy';

const VERSION = '0.3.3';

function sha256(content: Buffer | string): string {
  return createHash('sha256').update(content).digest('hex');
}

function scratch(): string {
  return mkdtempSync(join(tmpdir(), 'sync-policy-'));
}

function writeArtifacts(
  dir: string,
  options: { version?: string; catalogue?: Record<string, unknown> } = {}
): { manifest: Record<string, unknown>; policy: Buffer; data: Buffer } {
  const policy = Buffer.from('policy-bytes');
  const catalogue =
    options.catalogue ??
    Object.fromEntries(CAPABILITY_IDS.map(capability => [capability, { kind: 'baseline' }]));
  const data = Buffer.from(
    JSON.stringify({ authz: { catalogue, roles: {}, role_map: {}, routes: {} } })
  );
  writeFileSync(join(dir, 'policy.wasm'), policy);
  writeFileSync(join(dir, 'data.json'), data);
  const manifest = {
    version: options.version ?? VERSION,
    entrypoint: 'authz/capabilities',
    files: {
      'policy.wasm': { sha256: sha256(policy), bytes: policy.byteLength },
      'data.json': { sha256: sha256(data), bytes: data.byteLength },
    },
  };
  writeFileSync(join(dir, 'manifest.json'), JSON.stringify(manifest));
  return { manifest, policy, data };
}

const ok = (stdout = ''): CommandResult => ({ status: 0, stdout, stderr: '' });

afterEach(() => {
  vi.restoreAllMocks();
});

describe('readVersion', () => {
  it('reads and trims the pin', () => {
    const dir = scratch();
    try {
      writeFileSync(join(dir, 'VERSION'), '0.3.3\n');
      expect(readVersion(dir)).toBe('0.3.3');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('fails when the pin is missing', () => {
    const dir = scratch();
    try {
      expect(() => readVersion(dir)).toThrow(/VERSION is missing/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('verifyArtifacts', () => {
  it('accepts a matching manifest and reports both hashes', () => {
    const dir = scratch();
    try {
      const { policy, data } = writeArtifacts(dir);
      expect(verifyArtifacts(dir, VERSION)).toEqual({
        version: VERSION,
        policyHash: sha256(policy),
        dataHash: sha256(data),
      });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('rejects a tampered wasm file', () => {
    const dir = scratch();
    try {
      const { manifest } = writeArtifacts(dir);
      (manifest.files as Record<string, unknown>)['policy.wasm'] = {
        sha256: '0'.repeat(64),
        bytes: 12,
      };
      writeFileSync(join(dir, 'manifest.json'), JSON.stringify(manifest));
      expect(() => verifyArtifacts(dir, VERSION)).toThrow(/policy\.wasm sha256/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('rejects a manifest for another version', () => {
    const dir = scratch();
    try {
      writeArtifacts(dir, { version: '0.3.2' });
      expect(() => verifyArtifacts(dir, VERSION)).toThrow(/does not match the pinned 0\.3\.3/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('rejects a missing manifest', () => {
    const dir = scratch();
    try {
      expect(() => verifyArtifacts(dir, VERSION)).toThrow(/manifest\.json is missing/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('rejects a manifest whose data file is absent', () => {
    const dir = scratch();
    try {
      writeArtifacts(dir);
      rmSync(join(dir, 'data.json'));
      expect(() => verifyArtifacts(dir, VERSION)).toThrow(/data\.json is missing/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('rejects a release catalogue that drops a committed capability', () => {
    const dir = scratch();
    try {
      const catalogue = Object.fromEntries(
        CAPABILITY_IDS.filter(capability => capability !== CAPABILITY_IDS[0]).map(capability => [
          capability,
          { kind: 'baseline' },
        ])
      );
      writeArtifacts(dir, { catalogue });
      expect(() => verifyArtifacts(dir, VERSION)).toThrow(
        new RegExp(`missing capability ${CAPABILITY_IDS[0]}`)
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('downloadRelease', () => {
  it('names GH_TOKEN and gh auth login when gh rejects the download', () => {
    const dir = scratch();
    try {
      expect(() =>
        downloadRelease(VERSION, dir, () => ({ status: 1, stdout: '', stderr: 'denied' }))
      ).toThrow(/GH_TOKEN[\s\S]*gh auth login/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('asks gh for the three pinned assets', () => {
    const dir = scratch();
    try {
      const run = vi.fn((_command: string, _args: string[]) => ok());
      downloadRelease(VERSION, dir, run);
      expect(run).toHaveBeenCalledTimes(1);
      const [command, args] = run.mock.calls[0];
      expect(command).toBe('gh');
      expect(args).toEqual([
        'release',
        'download',
        `v${VERSION}`,
        '-R',
        'oparish1/authz-policy',
        '-D',
        dir,
        '--clobber',
        '-p',
        'policy.wasm',
        '-p',
        'data.json',
        '-p',
        'manifest.json',
      ]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('latestTag', () => {
  it('asks gh for the latest release without a tag argument', () => {
    const run = vi.fn((_command: string, _args: string[]) => ok('v0.3.4\n'));
    expect(latestTag(run)).toBe('v0.3.4');
    const [command, args] = run.mock.calls[0];
    expect(command).toBe('gh');
    expect(args).toEqual([
      'release',
      'view',
      '-R',
      'oparish1/authz-policy',
      '--json',
      'tagName',
      '--jq',
      '.tagName',
    ]);
  });

  it('fails when gh cannot read the latest release', () => {
    expect(() => latestTag(() => ({ status: 1, stdout: '', stderr: 'denied' }))).toThrow(
      /GH_TOKEN[\s\S]*gh auth login/
    );
  });
});

describe('main', () => {
  it('prints the latest tag without changing the pin', async () => {
    const before = readVersion();
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    await main(['--latest'], () => ok('v0.3.4\n'));
    expect(log).toHaveBeenCalledWith('v0.3.4');
    expect(readVersion()).toBe(before);
  });
});

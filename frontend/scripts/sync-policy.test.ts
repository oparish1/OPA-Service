import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CAPABILITY_IDS } from '../src/core/authz/generated';
import {
  downloadContract,
  downloadRelease,
  latestTag,
  main,
  readVersion,
  verifyArtifacts,
  verifyCatalogue,
  verifyContract,
  type CommandResult,
} from './sync-policy';

const VERSION = '0.3.3';

function sha256(content: Buffer | string): string {
  return createHash('sha256').update(content).digest('hex');
}

function scratch(): string {
  return mkdtempSync(join(tmpdir(), 'sync-policy-'));
}

interface Artifacts {
  manifest: Record<string, unknown>;
  policy: Buffer;
  data: Buffer;
  capabilityIds: string[];
}

function writeArtifacts(
  dir: string,
  options: {
    version?: string;
    catalogue?: Record<string, unknown>;
    capabilityIds?: string[];
  } = {}
): Artifacts {
  const policy = Buffer.from('policy-bytes');
  const capabilityIds = options.capabilityIds ?? [...CAPABILITY_IDS];
  const catalogue =
    options.catalogue ??
    Object.fromEntries(capabilityIds.map(capability => [capability, { kind: 'baseline' }]));
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
  writeContract(join(dir, 'contract'), { capabilityIds });
  return { manifest, policy, data, capabilityIds };
}

function writeContract(
  dir: string,
  options: { capabilityIds?: string[]; reasonPrecedence?: string[] } = {}
): void {
  const fixtures = join(dir, 'fixtures');
  mkdirSync(fixtures, { recursive: true });
  writeFileSync(
    join(fixtures, 'capability-ids.json'),
    JSON.stringify({
      capability_ids: options.capabilityIds ?? [...CAPABILITY_IDS],
      reason_precedence: options.reasonPrecedence ?? ['not_signed_in', 'missing_scope'],
    })
  );
  writeFileSync(join(fixtures, 'personas.json'), JSON.stringify({ config: {}, personas: [] }));
  writeFileSync(join(fixtures, 'matrix.snapshot.json'), JSON.stringify({ snapshot: {} }));
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

});

describe('verifyCatalogue', () => {
  it('accepts a release catalogue covering every contract capability', () => {
    const dir = scratch();
    try {
      const { capabilityIds } = writeArtifacts(dir);
      expect(() => verifyCatalogue(dir, VERSION, capabilityIds)).not.toThrow();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('rejects a release catalogue that drops a contract capability', () => {
    const dir = scratch();
    try {
      const capabilityIds = [...CAPABILITY_IDS];
      const catalogue = Object.fromEntries(
        capabilityIds
          .filter(capability => capability !== capabilityIds[0])
          .map(capability => [capability, { kind: 'baseline' }])
      );
      writeArtifacts(dir, { catalogue, capabilityIds });
      expect(() => verifyCatalogue(dir, VERSION, capabilityIds)).toThrow(
        new RegExp(`missing capability ${capabilityIds[0]}`)
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('rejects a data file without an authz catalogue', () => {
    const dir = scratch();
    try {
      writeArtifacts(dir);
      writeFileSync(join(dir, 'data.json'), JSON.stringify({ authz: {} }));
      expect(() => verifyCatalogue(dir, VERSION, [...CAPABILITY_IDS])).toThrow(
        /data\.json has no authz\.catalogue object/
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('verifyContract', () => {
  it('returns the capability ids and reason precedence', () => {
    const dir = scratch();
    try {
      writeContract(dir, {
        capabilityIds: ['nav.overview', 'nav.account'],
        reasonPrecedence: ['not_signed_in'],
      });
      expect(verifyContract(dir)).toEqual({
        capabilityIds: ['nav.overview', 'nav.account'],
        reasonPrecedence: ['not_signed_in'],
      });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('rejects a missing capability-ids.json', () => {
    const dir = scratch();
    try {
      expect(() => verifyContract(dir)).toThrow(/capability-ids\.json is missing/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('rejects malformed JSON', () => {
    const dir = scratch();
    try {
      mkdirSync(join(dir, 'fixtures'), { recursive: true });
      writeFileSync(join(dir, 'fixtures', 'capability-ids.json'), '{not json');
      expect(() => verifyContract(dir)).toThrow(/capability-ids\.json is not valid JSON/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('rejects non-array or empty-string fields', () => {
    const dir = scratch();
    try {
      for (const body of [
        { capability_ids: 'nav.overview', reason_precedence: [] },
        { capability_ids: [], reason_precedence: 'not_signed_in' },
        { capability_ids: [''], reason_precedence: [] },
      ]) {
        mkdirSync(join(dir, 'fixtures'), { recursive: true });
        writeFileSync(join(dir, 'fixtures', 'capability-ids.json'), JSON.stringify(body));
        expect(() => verifyContract(dir)).toThrow(/must be an array of non-empty strings/);
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('rejects a contract without the persona fixtures', () => {
    for (const missing of ['personas.json', 'matrix.snapshot.json']) {
      const dir = scratch();
      try {
        writeContract(dir);
        rmSync(join(dir, 'fixtures', missing));
        expect(() => verifyContract(dir)).toThrow(new RegExp(`${missing.replace('.', '\\.')} is missing`));
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    }
  });
});

describe('downloadContract', () => {
  it('pulls the pinned contract with oras and extracts it', () => {
    const dir = scratch();
    try {
      const run = vi.fn((_command: string, _args: string[]) => ok());
      downloadContract(VERSION, dir, run);
      expect(run).toHaveBeenCalledTimes(2);
      expect(run.mock.calls[0]).toEqual([
        'oras',
        ['pull', `ghcr.io/oparish1/authz-policy/authz-contract:${VERSION}`, '-o', dir],
      ]);
      expect(run.mock.calls[1]).toEqual([
        'tar',
        ['-xzf', join(dir, 'authz-contract.tar.gz'), '-C', dir],
      ]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('names oras when the pull is denied', () => {
    const dir = scratch();
    try {
      expect(() =>
        downloadContract(VERSION, dir, () => ({ status: 1, stdout: '', stderr: 'denied' }))
      ).toThrow(/could not download the authz contract[\s\S]*oras/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('fails when the tarball cannot be extracted', () => {
    const dir = scratch();
    try {
      const run = vi.fn((command: string) =>
        command === 'oras' ? ok() : { status: 1, stdout: '', stderr: 'bad archive' }
      );
      expect(() => downloadContract(VERSION, dir, run)).toThrow(/could not extract the authz contract/);
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

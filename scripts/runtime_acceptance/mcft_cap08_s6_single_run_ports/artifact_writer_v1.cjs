'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

function digestFileBytesV1(file) {
  const hash = crypto.createHash('sha256');
  const fd = fs.openSync(file, 'r');
  const buffer = Buffer.allocUnsafe(1024 * 1024);
  try {
    while (true) {
      const bytesRead = fs.readSync(fd, buffer, 0, buffer.length, null);
      if (bytesRead === 0) break;
      hash.update(buffer.subarray(0, bytesRead));
    }
  } finally {
    fs.closeSync(fd);
  }
  return `sha256:${hash.digest('hex')}`;
}

function createArtifactWriterV1({ root }) {
  return {
    async writeBundle(bundle) {
      const dir = path.join(root, 'acceptance-output');
      fs.mkdirSync(dir, { recursive: true });
      const development = bundle.execution_mode === 'DEVELOPMENT_REHEARSAL';
      const suffix = development ? 'DEVELOPMENT_REHEARSAL_BUNDLE' : 'FINAL_FORMAL_RUN_BUNDLE';
      const file = path.join(dir, `MCFT_CAP_08_S6_${bundle.spec.run_label}_${suffix}.json`);
      const body = {
        schema_version: development
          ? 'geox_mcft_cap08_s6_development_rehearsal_artifact_bundle_v1'
          : 'geox_mcft_cap08_s6_final_formal_run_artifact_bundle_v1',
        classification: development ? 'DEVELOPMENT_REHEARSAL' : 'FINAL_FORMAL',
        evidence_class: development ? 'NON_FORMAL' : 'FINAL_FORMAL',
        hard_acceptance_eligible: !development,
        artifact_ref: bundle.materialization.artifact_ref,
        artifact_digest: bundle.materialization.artifact_digest,
        ...bundle,
      };
      fs.writeFileSync(file, `${JSON.stringify(body, null, 2)}\n`);
      return {
        artifact_ref: bundle.materialization.artifact_ref,
        artifact_digest: bundle.materialization.artifact_digest,
        transport_file: `file://${file}`,
        transport_digest: digestFileBytesV1(file),
        retention_days: development ? 90 : 365,
      };
    },
  };
}

module.exports = { digestFileBytesV1, createArtifactWriterV1 };

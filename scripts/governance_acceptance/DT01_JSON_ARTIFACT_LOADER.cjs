// scripts/governance_acceptance/DT01_JSON_ARTIFACT_LOADER.cjs
// Purpose: load DT-01 plain JSON and legacy GZIP_BASE64_JSON artifacts without weakening content verification.
// Boundary: gzip trailer recovery is allowed only when the decoded bytes still match the committed length and SHA-256.

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const crypto = require('node:crypto');

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function failArtifact(relativePath, code, detail) {
  const suffix = detail ? `:${detail}` : '';
  throw new Error(`${code}:${relativePath}${suffix}`);
}

function skipZeroTerminatedField(buffer, start, end, relativePath, fieldName) {
  let cursor = start;
  while (cursor < end && buffer[cursor] !== 0) cursor += 1;
  if (cursor >= end) failArtifact(relativePath, 'GZIP_HEADER_INVALID', `${fieldName}_NOT_TERMINATED`);
  return cursor + 1;
}

function extractGzipDeflatePayload(gzipBuffer, relativePath) {
  if (gzipBuffer.length < 18) failArtifact(relativePath, 'GZIP_HEADER_INVALID', 'TOO_SHORT');
  if (gzipBuffer[0] !== 0x1f || gzipBuffer[1] !== 0x8b) failArtifact(relativePath, 'GZIP_HEADER_INVALID', 'BAD_MAGIC');
  if (gzipBuffer[2] !== 0x08) failArtifact(relativePath, 'GZIP_HEADER_INVALID', 'UNSUPPORTED_METHOD');

  const flags = gzipBuffer[3];
  if ((flags & 0xe0) !== 0) failArtifact(relativePath, 'GZIP_HEADER_INVALID', 'RESERVED_FLAGS_SET');

  const trailerStart = gzipBuffer.length - 8;
  let cursor = 10;

  if ((flags & 0x04) !== 0) {
    if (cursor + 2 > trailerStart) failArtifact(relativePath, 'GZIP_HEADER_INVALID', 'EXTRA_LENGTH_MISSING');
    const extraLength = gzipBuffer.readUInt16LE(cursor);
    cursor += 2 + extraLength;
    if (cursor > trailerStart) failArtifact(relativePath, 'GZIP_HEADER_INVALID', 'EXTRA_FIELD_OVERRUN');
  }

  if ((flags & 0x08) !== 0) cursor = skipZeroTerminatedField(gzipBuffer, cursor, trailerStart, relativePath, 'FILENAME');
  if ((flags & 0x10) !== 0) cursor = skipZeroTerminatedField(gzipBuffer, cursor, trailerStart, relativePath, 'COMMENT');

  if ((flags & 0x02) !== 0) {
    cursor += 2;
    if (cursor > trailerStart) failArtifact(relativePath, 'GZIP_HEADER_INVALID', 'HEADER_CRC_OVERRUN');
  }

  if (cursor >= trailerStart) failArtifact(relativePath, 'GZIP_HEADER_INVALID', 'EMPTY_DEFLATE_PAYLOAD');
  return gzipBuffer.subarray(cursor, trailerStart);
}

function decodeArtifactBuffer(storedBuffer, relativePath, expectedSha256 = null) {
  let outer;
  try {
    outer = JSON.parse(storedBuffer.toString('utf8'));
  } catch (error) {
    failArtifact(relativePath, 'ARTIFACT_JSON_PARSE_FAILED', error.message);
  }

  if (outer?.encoding !== 'GZIP_BASE64_JSON') {
    const digest = sha256(storedBuffer);
    if (expectedSha256 && digest !== expectedSha256) {
      failArtifact(relativePath, 'ARTIFACT_SHA256_MISMATCH', `expected=${expectedSha256},actual=${digest}`);
    }
    return {
      value: outer,
      raw: storedBuffer,
      digest,
      transport: 'PLAIN_JSON',
      recovery: null,
    };
  }

  if (typeof outer.payload !== 'string' || outer.payload.length === 0) {
    failArtifact(relativePath, 'ENCODED_JSON_PAYLOAD_MISSING');
  }

  const gzipBuffer = Buffer.from(outer.payload, 'base64');
  let raw;
  let recovery = null;

  try {
    raw = zlib.gunzipSync(gzipBuffer);
  } catch (gunzipError) {
    try {
      const deflatePayload = extractGzipDeflatePayload(gzipBuffer, relativePath);
      raw = zlib.inflateRawSync(deflatePayload);
      recovery = {
        mode: 'GZIP_TRAILER_RECOVERY_WITH_SHA256',
        original_error_code: gunzipError.code || 'UNKNOWN',
        original_error_message: gunzipError.message,
      };
    } catch (inflateError) {
      failArtifact(
        relativePath,
        'ENCODED_JSON_DECOMPRESSION_FAILED',
        `gunzip=${gunzipError.code || gunzipError.message};inflateRaw=${inflateError.code || inflateError.message}`,
      );
    }
  }

  const digest = sha256(raw);

  if (Number.isInteger(outer.decoded_bytes) && raw.length !== outer.decoded_bytes) {
    failArtifact(relativePath, 'ENCODED_JSON_LENGTH_MISMATCH', `expected=${outer.decoded_bytes},actual=${raw.length}`);
  }
  if (typeof outer.decoded_sha256 !== 'string' || digest !== outer.decoded_sha256) {
    failArtifact(relativePath, 'ENCODED_JSON_SHA256_MISMATCH', `expected=${outer.decoded_sha256},actual=${digest}`);
  }
  if (expectedSha256 && digest !== expectedSha256) {
    failArtifact(relativePath, 'ARTIFACT_SHA256_MISMATCH', `expected=${expectedSha256},actual=${digest}`);
  }

  let value;
  try {
    value = JSON.parse(raw.toString('utf8'));
  } catch (error) {
    failArtifact(relativePath, 'DECODED_JSON_PARSE_FAILED', error.message);
  }

  return {
    value,
    raw,
    digest,
    transport: 'GZIP_BASE64_JSON',
    recovery,
  };
}

function loadArtifactFile(root, relativePath, expectedSha256 = null) {
  const storedBuffer = fs.readFileSync(path.join(root, relativePath));
  return decodeArtifactBuffer(storedBuffer, relativePath, expectedSha256);
}

function loadInventoryManifest(root, relativePath) {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, relativePath), 'utf8'));
  const capabilities = [];
  const artifactTransports = [];

  for (const part of manifest.part_files || []) {
    const loaded = loadArtifactFile(root, part.path, part.sha256);
    capabilities.push(...(loaded.value.capabilities || []));
    artifactTransports.push({
      path: part.path,
      transport: loaded.transport,
      recovery: loaded.recovery,
      sha256: loaded.digest,
    });
  }

  return {
    manifest,
    capabilities,
    artifact_transports: artifactTransports,
  };
}

function runCorruptTrailerSelfTest() {
  const raw = Buffer.from('{"self_test":"dt01_corrupt_gzip_trailer"}', 'utf8');
  const gzipBuffer = zlib.gzipSync(raw);
  const corrupted = Buffer.from(gzipBuffer);
  corrupted[corrupted.length - 8] ^= 0xff;

  const digest = sha256(raw);
  const envelope = Buffer.from(JSON.stringify({
    schema_version: 'geox_dt01_encoded_json_artifact_test_v1',
    encoding: 'GZIP_BASE64_JSON',
    decoded_sha256: digest,
    decoded_bytes: raw.length,
    payload: corrupted.toString('base64'),
  }), 'utf8');

  const loaded = decodeArtifactBuffer(envelope, '<dt01-loader-self-test>', digest);
  if (loaded.raw.compare(raw) !== 0) throw new Error('DT01_ARTIFACT_LOADER_SELF_TEST_CONTENT_MISMATCH');
  if (loaded.recovery?.mode !== 'GZIP_TRAILER_RECOVERY_WITH_SHA256') {
    throw new Error('DT01_ARTIFACT_LOADER_SELF_TEST_RECOVERY_NOT_EXERCISED');
  }

  return loaded.recovery;
}

module.exports = {
  decodeArtifactBuffer,
  loadArtifactFile,
  loadInventoryManifest,
  runCorruptTrailerSelfTest,
};

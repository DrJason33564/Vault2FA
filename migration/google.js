// SPDX-License-Identifier: MIT
// Google Authenticator migration decoder

(function () {
  const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

  function bytesToBase32(bytes) {
    let bits = 0;
    let value = 0;
    let output = "";

    for (const byte of bytes) {
      value = (value << 8) | byte;
      bits += 8;

      while (bits >= 5) {
        output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
        bits -= 5;
      }
    }

    if (bits > 0) {
      output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
    }

    return output;
  }

  function base64ToBytes(base64) {
    const normalized = base64.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized + "=".repeat((4 - normalized.length % 4) % 4);
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }

  function readVarint(bytes, offset) {
    let result = 0;
    let shift = 0;
    let pos = offset;

    while (true) {
      const byte = bytes[pos++];
      result |= (byte & 0x7f) << shift;
      if (!(byte & 0x80)) break;
      shift += 7;
    }

    return { value: result, offset: pos };
  }

  function readBytes(bytes, offset) {
    const { value: len, offset: o2 } = readVarint(bytes, offset);
    const end = o2 + len;
    return { value: bytes.slice(o2, end), offset: end };
  }

  function readString(bytes, offset) {
    const { value, offset: o2 } = readBytes(bytes, offset);
    return { value: new TextDecoder().decode(value), offset: o2 };
  }

  function parseOtp(bytes) {
    let offset = 0;
    const obj = {};

    while (offset < bytes.length) {
      const { value: tag, offset: o2 } = readVarint(bytes, offset);
      offset = o2;
      const field = tag >> 3;
      const wire = tag & 7;

      if (field === 1) {
        const r = readBytes(bytes, offset);
        obj.secret = r.value;
        offset = r.offset;
      } else if (field === 2) {
        const r = readString(bytes, offset);
        obj.name = r.value;
        offset = r.offset;
      } else if (field === 3) {
        const r = readString(bytes, offset);
        obj.issuer = r.value;
        offset = r.offset;
      } else if (field === 4 || field === 5 || field === 6 || field === 7) {
        const r = readVarint(bytes, offset);
        obj[field] = r.value;
        offset = r.offset;
      } else {
        if (wire === 2) {
          const r = readBytes(bytes, offset);
          offset = r.offset;
        } else if (wire === 0) {
          const r = readVarint(bytes, offset);
          offset = r.offset;
        } else {
          break;
        }
      }
    }

    return obj;
  }

  function decodeGoogleMigrationUri(uri) {
    const url = new URL(uri);
    const data = url.searchParams.get("data");
    if (!data) throw new Error("invalid");

    const bytes = base64ToBytes(data);

    let offset = 0;
    const accounts = [];

    while (offset < bytes.length) {
      const { value: tag, offset: o2 } = readVarint(bytes, offset);
      offset = o2;

      const field = tag >> 3;
      const wire = tag & 7;

      if (field === 1 && wire === 2) {
        const r = readBytes(bytes, offset);
        offset = r.offset;

        const otp = parseOtp(r.value);

        const secret = bytesToBase32(otp.secret || new Uint8Array());

        accounts.push({
          secret,
          name: otp.name || "",
          issuer: otp.issuer || "",
          algorithm: ["SHA1", "SHA1", "SHA256", "SHA512", "MD5"][otp[4] || 1],
          digits: otp[5] === 2 ? 8 : 6,
          type: otp[6] === 1 ? "hotp" : "totp",
          counter: otp[7] || 0,
          period: 30,
        });
      } else {
        if (wire === 2) {
          const r = readBytes(bytes, offset);
          offset = r.offset;
        } else if (wire === 0) {
          const r = readVarint(bytes, offset);
          offset = r.offset;
        } else {
          break;
        }
      }
    }

    return { accounts };
  }

  function buildOtpAuthUri(a) {
    const label = encodeURIComponent(
      a.issuer ? `${a.issuer}:${a.name}` : a.name || "Imported"
    );

    const params = new URLSearchParams();
    params.set("secret", a.secret);

    if (a.issuer) params.set("issuer", a.issuer);
    if (a.algorithm) params.set("algorithm", a.algorithm);
    if (a.digits) params.set("digits", String(a.digits));

    if (a.type === "hotp") {
      params.set("counter", String(a.counter || 0));
      return `otpauth://hotp/${label}?${params}`;
    }

    params.set("period", String(a.period || 30));
    return `otpauth://totp/${label}?${params}`;
  }

  function isGoogleMigrationUri(s) {
    return typeof s === "string" && s.startsWith("otpauth-migration://");
  }

  window.Vault2FAGoogleMigration = {
    isGoogleMigrationUri,
    decodeGoogleMigrationUri,
    buildOtpAuthUri,
  };
})();

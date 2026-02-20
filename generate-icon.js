// Script untuk generate ikon tray PNG
// Jalankan: node generate-icon.js

const { createCanvas } = (() => {
  // Use built-in approach - create a simple 32x32 PNG manually
  // We'll create a minimal PNG file with a crescent moon
  return { createCanvas: null };
})();

const fs = require('fs');
const path = require('path');

// Create a minimal 32x32 RGBA bitmap for the tray icon
const size = 256;
const pixels = Buffer.alloc(size * size * 4, 0);

function setPixel(x, y, r, g, b, a = 255) {
  if (x < 0 || x >= size || y < 0 || y >= size) return;
  const idx = (y * size + x) * 4;
  pixels[idx] = r;
  pixels[idx + 1] = g;
  pixels[idx + 2] = b;
  pixels[idx + 3] = a;
}

function dist(x1, y1, x2, y2) {
  return Math.sqrt((x1 - x2) ** 2 + (y1 - y2) ** 2);
}

// Draw crescent moon + star
const scale = 8;
const cx = 14 * scale, cy = 16 * scale;
const outerR = 12 * scale;
const innerR = 9 * scale;
const offsetX = 5 * scale;

for (let y = 0; y < size; y++) {
  for (let x = 0; x < size; x++) {
    const d1 = dist(x, y, cx, cy);
    const d2 = dist(x, y, cx + offsetX, cy);

    // Crescent moon
    if (d1 <= outerR && d2 > innerR) {
      // Gradient purple to blue
      const t = (x - (cx - outerR)) / (2 * outerR);
      const r = Math.round(108 + t * 50);
      const g = Math.round(99 - t * 20);
      const b = 255;
      setPixel(x, y, r, g, b);
    }

    // Star
    const sx = 25 * scale, sy = 7 * scale, sr = 2.5 * scale;
    const sd = dist(x, y, sx, sy);
    if (sd <= sr) {
      setPixel(x, y, 232, 213, 183); // Gold
    }
  }
}

// Create PNG file manually using zlib
const zlib = require('zlib');

function createPNG(width, height, rgbaBuffer) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  function crc32(buf) {
    let crc = 0xFFFFFFFF;
    const table = new Int32Array(256);
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let j = 0; j < 8; j++) {
        c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      }
      table[i] = c;
    }
    for (let i = 0; i < buf.length; i++) {
      crc = table[(crc ^ buf[i]) & 0xFF] ^ (crc >>> 8);
    }
    return (crc ^ 0xFFFFFFFF) >>> 0;
  }

  function makeChunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const typeBuffer = Buffer.from(type, 'ascii');
    const crcData = Buffer.concat([typeBuffer, data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(crcData));
    return Buffer.concat([len, typeBuffer, data, crc]);
  }

  // IHDR
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;  // Bit depth
  ihdr[9] = 6;  // Color type (RGBA)
  ihdr[10] = 0; // Compression
  ihdr[11] = 0; // Filter
  ihdr[12] = 0; // Interlace

  // IDAT - filter each row with filter type 0 (None)
  const rawData = Buffer.alloc(height * (1 + width * 4));
  for (let y = 0; y < height; y++) {
    rawData[y * (1 + width * 4)] = 0; // Filter byte
    rgbaBuffer.copy(rawData, y * (1 + width * 4) + 1, y * width * 4, (y + 1) * width * 4);
  }
  const compressed = zlib.deflateSync(rawData);

  // IEND
  const iend = Buffer.alloc(0);

  return Buffer.concat([
    signature,
    makeChunk('IHDR', ihdr),
    makeChunk('IDAT', compressed),
    makeChunk('IEND', iend)
  ]);
}

const png = createPNG(size, size, pixels);
const assetsDir = path.join(__dirname, 'assets');
if (!fs.existsSync(assetsDir)) {
  fs.mkdirSync(assetsDir, { recursive: true });
}
fs.writeFileSync(path.join(assetsDir, 'icon.png'), png);
console.log('Icon generated at assets/icon.png');

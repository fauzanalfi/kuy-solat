const https = require('https');
const fs = require('fs');
const path = require('path');
const { app } = require('electron');
const store = require('./store');

const CACHE_FILE = path.join(app ? app.getPath('userData') : __dirname, 'location-cache.json');

// Default: Jakarta
const DEFAULT_LOCATION = {
  latitude: -6.2088,
  longitude: 106.8456,
  city: 'Jakarta',
  region: 'DKI Jakarta',
  country: 'Indonesia'
};

/**
 * Mendapatkan koordinat dari nama kota manual via API Geocoding Photon (Gratis, HTTPS)
 */
function getCoordinatesForCity(cityName) {
  return new Promise((resolve) => {
    const options = {
      hostname: 'photon.komoot.io',
      path: '/api/?q=' + encodeURIComponent(cityName) + '&limit=1',
      method: 'GET',
      timeout: 5000,
      headers: {
        'User-Agent': 'KuySolatApp/1.0'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.features && json.features.length > 0) {
            const coords = json.features[0].geometry.coordinates;
            const props = json.features[0].properties;
            resolve({
              latitude: coords[1],
              longitude: coords[0],
              city: props.name || cityName,
              region: props.state || '',
              country: props.country || 'Indonesia'
            });
          } else {
            resolve(null);
          }
        } catch {
          resolve(null);
        }
      });
    });

    req.on('error', () => resolve(null));
    req.on('timeout', () => {
      req.destroy();
      resolve(null);
    });
    req.end();
  });
}

/**
 * Deteksi lokasi menggunakan freeipapi.com (HTTPS)
 */
function detectAutoLocation() {
  return new Promise((resolve) => {
    const options = {
      hostname: 'freeipapi.com',
      path: '/api/json',
      method: 'GET',
      timeout: 5000
    };

    const req = https.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.latitude && json.longitude) {
            const location = {
              latitude: json.latitude,
              longitude: json.longitude,
              city: json.cityName || json.regionName,
              region: json.regionName,
              country: json.countryName
            };
            // Cache lokasi otomatis
            saveLocationCache(location);
            resolve(location);
          } else {
            resolve(getLocationFromCache());
          }
        } catch (e) {
          resolve(getLocationFromCache());
        }
      });
    });

    req.on('error', () => {
      resolve(getLocationFromCache());
    });

    req.on('timeout', () => {
      req.destroy();
      resolve(getLocationFromCache());
    });

    req.end();
  });
}

/**
 * Mendapatkan lokasi berdasarkan setting (Auto / Manual)
 */
async function detectLocation() {
  const locSetting = store.get('location');
  
  if (locSetting.type === 'manual') {
    // Coba hit API untuk dapatin koordinat dari manualCity
    const coords = await getCoordinatesForCity(locSetting.manualCity);
    if (coords) {
      return coords;
    }
    // Fallback kalau API gagal tapi manual mode
    return {
      latitude: locSetting.manualCoordinates.latitude,
      longitude: locSetting.manualCoordinates.longitude,
      city: locSetting.manualCity,
      region: 'Manual',
      country: 'Indonesia'
    };
  }

  // Jika auto
  return await detectAutoLocation();
}

/**
 * Simpan lokasi ke cache file
 */
function saveLocationCache(location) {
  try {
    fs.writeFileSync(CACHE_FILE, JSON.stringify(location, null, 2));
  } catch (e) {
    console.error('Failed to save location cache:', e.message);
  }
}

/**
 * Baca lokasi dari cache, atau kembalikan default
 */
function getLocationFromCache() {
  try {
    if (fs.existsSync(CACHE_FILE)) {
      const data = fs.readFileSync(CACHE_FILE, 'utf-8');
      return JSON.parse(data);
    }
  } catch (e) {
    console.error('Failed to read location cache:', e.message);
  }
  return DEFAULT_LOCATION;
}

module.exports = {
  detectLocation,
  getLocationFromCache,
  DEFAULT_LOCATION,
  getCoordinatesForCity
};

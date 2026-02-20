const Store = require("electron-store");

const schema = {
  location: {
    type: "object",
    properties: {
      type: {
        type: "string",
        enum: ["auto", "manual"],
        default: "auto",
      },
      manualCity: {
        type: "string",
        default: "Jakarta",
      },
      manualCoordinates: {
        type: "object",
        properties: {
          latitude: { type: "number" },
          longitude: { type: "number" },
        },
        default: {
          latitude: -6.2088,
          longitude: 106.8456,
        },
      },
    },
    default: {
      type: "auto",
      manualCity: "Jakarta",
      manualCoordinates: {
        latitude: -6.2088,
        longitude: 106.8456,
      },
    },
  },
  audio: {
    type: "object",
    properties: {
      enabled: {
        type: "boolean",
        default: true,
      },
      file: {
        type: "string",
        default: "default", // 'default' atau path absolut file custom
      },
      muted: {
        type: "object",
        properties: {
          subuh: { type: "boolean", default: false },
          terbit: { type: "boolean", default: false },
          dzuhur: { type: "boolean", default: false },
          ashar: { type: "boolean", default: false },
          maghrib: { type: "boolean", default: false },
          isya: { type: "boolean", default: false }
        },
        default: {
          subuh: false,
          terbit: false,
          dzuhur: false,
          ashar: false,
          maghrib: false,
          isya: false
        }
      }
    },
    default: {
      enabled: true,
      file: "default",
      muted: {
        subuh: false,
        terbit: false,
        dzuhur: false,
        ashar: false,
        maghrib: false,
        isya: false
      }
    },
  },
  autoStart: {
    type: "boolean",
    default: false,
  },
  theme: {
    type: "string",
    enum: ["default", "hijau", "putih", "hitam"],
    default: "default"
  }
};

const store = new Store({ schema });

module.exports = store;

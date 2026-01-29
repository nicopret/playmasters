import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.playmasters.app',
  appName: 'Playmasters',
  webDir: 'dist',
  server: {
    url: process.env.PLAYMASTERS_WEB_URL || 'http://localhost:3000',
    cleartext: true
  },
  android: {
    allowMixedContent: true
  }
};

export default config;

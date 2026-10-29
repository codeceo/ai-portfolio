import type { Config } from 'tailwindcss';
const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#0a0a0f',
        coal: '#12121a',
        mist: '#e8e8ee',
        muted2: '#9a9aad',
        lavender: '#a5a8d8',
        periwinkle: '#7c7fc4'
      },
      borderRadius: { xl2: '1.25rem' },
      fontFamily: { sans: ['system-ui', '-apple-system', 'PingFang SC', 'Microsoft YaHei', 'sans-serif'] }
    }
  },
  plugins: []
};
export default config;

import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        warm: {
          DEFAULT: '#C4A77D',
          light: '#E8DFD0',
        },
        blue: {
          DEFAULT: '#8BA4B4',
          light: '#D4DEE4',
        },
      },
    },
  },
  plugins: [],
};

export default config;

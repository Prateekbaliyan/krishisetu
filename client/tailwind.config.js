/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: '#F7F9F4',
        card: '#FFFFFF',
        primary: {
          DEFAULT: '#527A50',
          dark: '#24452F',
          light: '#E6EFE2',
          hover: '#426440'
        },
        forest: '#24452F',
        sage: '#E6EFE2',
        border: '#E5EAE1',
        text: {
          main: '#202B22',
          secondary: '#738071',
          muted: '#8F9C8D'
        },
        warning: {
          DEFAULT: '#D97706',
          bg: '#FEF3C7',
          border: '#FDE68A'
        },
        error: {
          DEFAULT: '#DC2626',
          bg: '#FEE2E2',
          border: '#FECACA'
        },
        success: {
          DEFAULT: '#16A34A',
          bg: '#DCFCE7',
          border: '#BBF7D0'
        }
      },
      fontFamily: {
        sans: ['Inter', 'Noto Sans Devanagari', 'system-ui', 'sans-serif'],
        marathi: ['Noto Sans Devanagari', 'Inter', 'sans-serif']
      },
      borderRadius: {
        'card': '12px',
        'button': '10px'
      },
      boxShadow: {
        'subtle': '0 1px 3px 0 rgba(36, 69, 47, 0.05), 0 1px 2px 0 rgba(36, 69, 47, 0.03)',
        'card': '0 4px 6px -1px rgba(36, 69, 47, 0.05), 0 2px 4px -1px rgba(36, 69, 47, 0.03)',
        'elevated': '0 10px 15px -3px rgba(36, 69, 47, 0.08), 0 4px 6px -2px rgba(36, 69, 47, 0.04)'
      }
    },
  },
  plugins: [],
}


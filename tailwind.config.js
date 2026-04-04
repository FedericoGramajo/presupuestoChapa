/** @type {import('tailwindcss').Config} */
module.exports = {
    content: ['./src/**/*.{html,ts,scss}'],
    theme: {
        extend: {
            colors: {
                accent: '#f0a500',
                'accent-dark': '#e07b00',
            },
        },
    },
    plugins: [],
    // Evitar que Tailwind interfiera con los estilos de Angular Material
    corePlugins: {
        preflight: false,
    },
};

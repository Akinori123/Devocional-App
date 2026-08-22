const fs = require('fs');
let content = fs.readFileSync('src/components/BottomNav.tsx', 'utf8');

content = content.replace(
  '<nav className="fixed bottom-0 w-full bg-white border-t border-gray-200 pb-safe">',
  '<nav className="absolute bottom-0 w-full bg-white dark:bg-slate-900 border-t border-gray-200 dark:border-slate-800 pb-safe z-50 transition-colors duration-200">'
);
// In React/Tailwind when container is relative and overflow-hidden, absolute bottom-0 works beautifully to stay inside max-w-md.

fs.writeFileSync('src/components/BottomNav.tsx', content);

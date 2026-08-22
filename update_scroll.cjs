const fs = require('fs');
let code = fs.readFileSync('src/components/BottomNav.tsx', 'utf8');

const target = `    const handleScroll = (e: Event) => {
      const target = e.target as HTMLElement;
      // Make sure we're dealing with a vertical scrolling container
      if (target.scrollTop === undefined) return;
      
      const currentScrollY = target.scrollTop;
      
      // Ignore tiny scrolls
      if (currentScrollY > lastScrollY.current + 10) {
        // scrolling down
        setIsVisible(false);
      } else if (currentScrollY < lastScrollY.current - 10) {
        // scrolling up
        setIsVisible(true);
      }
      
      // Also show if we are near the top
      if (currentScrollY < 50) {
        setIsVisible(true);
      }
      lastScrollY.current = currentScrollY;
    };`;

const replacement = `    const handleScroll = (e: Event) => {
      let currentScrollY = 0;
      if (e.target === document || e.target === window) {
        currentScrollY = window.scrollY;
      } else {
        const target = e.target as HTMLElement;
        if (target.scrollTop !== undefined) {
          currentScrollY = target.scrollTop;
        } else {
          return;
        }
      }
      if (currentScrollY > lastScrollY.current + 10) {
        setIsVisible(false);
      } else if (currentScrollY < lastScrollY.current - 10) {
        setIsVisible(true);
      }
      if (currentScrollY < 50) {
        setIsVisible(true);
      }
      lastScrollY.current = currentScrollY;
    };`;

code = code.replace(target, replacement);
fs.writeFileSync('src/components/BottomNav.tsx', code);

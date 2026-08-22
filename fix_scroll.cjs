const fs = require('fs');
let code = fs.readFileSync('src/components/BottomNav.tsx', 'utf8');
code = code.replace(/const handleScroll = \(e: Event\) => \{[\s\S]*?lastScrollY\.current = currentScrollY;\n    \};/, 
`const handleScroll = (e: Event) => {
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
    };`);
fs.writeFileSync('src/components/BottomNav.tsx', code);

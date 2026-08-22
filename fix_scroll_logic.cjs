const fs = require('fs');
let code = fs.readFileSync('src/components/BottomNav.tsx', 'utf8');
code = code.replace(/if \(currentScrollY > lastScrollY\.current \+ 10\) \{[\s\S]*?lastScrollY\.current = currentScrollY;\n    \};/, 
`if (currentScrollY > lastScrollY.current + 10) {
        setIsVisible(false);
        lastScrollY.current = currentScrollY;
      } else if (currentScrollY < lastScrollY.current - 10) {
        setIsVisible(true);
        lastScrollY.current = currentScrollY;
      }
      if (currentScrollY < 50) {
        setIsVisible(true);
      }
    };`);
fs.writeFileSync('src/components/BottomNav.tsx', code);

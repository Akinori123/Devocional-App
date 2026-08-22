const fs = require('fs');
let content = fs.readFileSync('src/pages/Home.tsx', 'utf8');

// import doc and getDoc
content = content.replace(
  "import { sendEmailVerification } from 'firebase/auth';",
  "import { sendEmailVerification } from 'firebase/auth';\nimport { doc, getDoc } from 'firebase/firestore';\nimport { db } from '../lib/firebase';"
);

const fetchEffect = `
  useEffect(() => {
    const fetchAdminContent = async () => {
      try {
        const docRef = doc(db, 'settings', 'daily_content');
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data.videoId || data.verseText) {
            setDailyData(prev => ({
              videoId: data.videoId || prev.videoId,
              verse: {
                text: data.verseText || prev.verse.text,
                reference: data.verseRef || prev.verse.reference
              }
            }));
          }
        }
      } catch (err) {
        console.error("Error fetching admin content", err);
      }
    };
    fetchAdminContent();
  }, []);
`;

content = content.replace(
  "const streakCount = profile?.streakCount || 0;",
  "const streakCount = profile?.streakCount || 0;\n" + fetchEffect
);

fs.writeFileSync('src/pages/Home.tsx', content);

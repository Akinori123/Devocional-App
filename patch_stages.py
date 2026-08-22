import sys

with open('src/components/journey/JourneyList.tsx', 'r') as f:
    journey_content = f.read()

old_journey = """  const getPlantInfo = (streak: number) => {
    if (streak === 0) return { icon: '🌱', label: 'Iniciante' };
    if (streak < 7) return { icon: '🌿', label: 'Caminhando' };
    if (streak < 30) return { icon: '🌸', label: 'Florescendo' };
    return { icon: '🌳', label: 'Constante' };
  };"""

new_journey = """  const getPlantInfo = (streak: number) => {
    if (streak === 0) return { icon: '🌱', label: 'Semente' };
    if (streak < 7) return { icon: '🌿', label: 'Broto' };
    if (streak < 30) return { icon: '🪴', label: 'Crescendo' };
    if (streak < 90) return { icon: '🌸', label: 'Florescendo' };
    if (streak < 365) return { icon: '🌳', label: 'Árvore Firme' };
    return { icon: '👑', label: 'Inabalável' };
  };"""

journey_content = journey_content.replace(old_journey, new_journey)

with open('src/components/journey/JourneyList.tsx', 'w') as f:
    f.write(journey_content)

with open('src/pages/Home.tsx', 'r') as f:
    home_content = f.read()

old_home = """  const getStreakText = (days: number) => {
    if (days === 0) return `Seu primeiro dia de jornada! 🌱`;
    if (days === 1) return `1 dia dando os primeiros passos... 🌱`;
    if (days < 7) return `${days} dias caminhando com Cristo! 🌿`;
    if (days < 30) return `${days} dias de constância e fé! 🪴`;
    if (days < 120) return `${days} dias! Raízes profundas! 🌸`;
    if (days < 365) return `${days} dias! Seu coração está florescendo! 🌳`;
    return `${days} dias! Uma jornada inabalável na fé! ✨`;
  };"""

new_home = """  const getStreakText = (days: number) => {
    if (days === 0) return `Seu primeiro dia de jornada! 🌱`;
    if (days === 1) return `1 dia dando os primeiros passos... 🌱`;
    if (days < 7) return `${days} dias caminhando com Cristo! 🌿`;
    if (days < 30) return `${days} dias de raízes crescendo! 🪴`;
    if (days < 90) return `${days} dias! Seu coração está florescendo! 🌸`;
    if (days < 365) return `${days} dias! Uma árvore firme e constante! 🌳`;
    return `${days} dias! Mais de um ano inabalável na fé! 👑`;
  };"""

home_content = home_content.replace(old_home, new_home)

with open('src/pages/Home.tsx', 'w') as f:
    f.write(home_content)


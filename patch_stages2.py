import sys

with open('src/components/journey/JourneyList.tsx', 'r') as f:
    journey_content = f.read()

old_journey = """  const getPlantInfo = (streak: number) => {
    if (streak === 0) return { icon: '🌱', label: 'Semente' };
    if (streak < 7) return { icon: '🌿', label: 'Broto' };
    if (streak < 30) return { icon: '🪴', label: 'Crescendo' };
    if (streak < 90) return { icon: '🌸', label: 'Florescendo' };
    if (streak < 365) return { icon: '🌳', label: 'Árvore Firme' };
    return { icon: '👑', label: 'Inabalável' };
  };"""

new_journey = """  const getPlantInfo = (streak: number) => {
    if (streak === 0) return { icon: '🌱', label: 'Iniciante' };
    if (streak < 7) return { icon: '🌿', label: 'Caminhando' };
    if (streak < 30) return { icon: '🌸', label: 'Florescendo' };
    return { icon: '🌳', label: 'Constante' };
  };"""

journey_content = journey_content.replace(old_journey, new_journey)

with open('src/components/journey/JourneyList.tsx', 'w') as f:
    f.write(journey_content)


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
    if (streak === 0) return { icon: '🌱', label: 'Iniciante' };
    if (streak < 7) return { icon: '🌿', label: 'Caminhando' };
    if (streak < 30) return { icon: '🌸', label: 'Florescendo' };
    if (streak < 365) return { icon: '🌳', label: 'Constante' };
    return { icon: '👑', label: 'Inabalável' };
  };"""

journey_content = journey_content.replace(old_journey, new_journey)

with open('src/components/journey/JourneyList.tsx', 'w') as f:
    f.write(journey_content)


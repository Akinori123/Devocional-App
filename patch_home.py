import sys

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
    if (days < 30) return `${days} dias de constância e fé! 🌸`;
    if (days < 120) return `${days} dias! Seu coração está florescendo! 🌸`;
    if (days < 365) return `${days} dias! Raízes profundas, árvore firme! 🌳`;
    return `${days} dias! Uma jornada inabalável na fé! ✨`;
  };"""

home_content = home_content.replace(old_home, new_home)

with open('src/pages/Home.tsx', 'w') as f:
    f.write(home_content)


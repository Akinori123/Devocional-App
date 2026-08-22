export interface JourneyStatus {
  emoji: string;
  icon: string;
  label: string;
  text: string;
}

export function getJourneyStatus(days: number): JourneyStatus {
  if (days <= 0) {
    return {
      emoji: '🌱',
      icon: '🌱',
      label: 'Iniciante',
      text: 'Iniciante: Dando os primeiros passos!'
    };
  }
  if (days === 1) {
    return {
      emoji: '🌱',
      icon: '🌱',
      label: 'Semente',
      text: '1 dia dando os primeiros passos...'
    };
  }
  if (days < 7) {
    return {
      emoji: '🌿',
      icon: '🌿',
      label: 'Caminhando',
      text: `${days} dias caminhando com Cristo!`
    };
  }
  if (days < 30) {
    return {
      emoji: '🌸',
      icon: '🌸',
      label: 'Florescendo',
      text: `${days} dias! Suas raízes florescendo!`
    };
  }
  if (days < 365) {
    return {
      emoji: '🌳',
      icon: '🌳',
      label: 'Constante',
      text: `${days} dias! Árvore forte e constante!`
    };
  }
  return {
    emoji: '👑',
    icon: '👑',
    label: 'Inabalável',
    text: `${days} dias! Uma jornada inabalável na fé!`
  };
}

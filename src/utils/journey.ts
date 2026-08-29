export interface JourneyStatus {
  emoji: string;
  icon: string;
  label: string;
  text: string;
}

export function getJourneyStatus(days: number): JourneyStatus {
  const dayText = days === 1 ? '1 dia' : `${days} dias`;
  if (days <= 0) {
    return {
      emoji: '🌱',
      icon: '🌱',
      label: 'Iniciante',
      text: '0 dias'
    };
  }
  if (days === 1) {
    return {
      emoji: '🌱',
      icon: '🌱',
      label: 'Semente',
      text: '1 dia'
    };
  }
  if (days < 7) {
    return {
      emoji: '🌿',
      icon: '🌿',
      label: 'Caminhando',
      text: dayText
    };
  }
  if (days < 30) {
    return {
      emoji: '🌸',
      icon: '🌸',
      label: 'Florescendo',
      text: dayText
    };
  }
  if (days < 365) {
    return {
      emoji: '🌳',
      icon: '🌳',
      label: 'Constante',
      text: dayText
    };
  }
  return {
    emoji: '👑',
    icon: '👑',
    label: 'Inabalável',
    text: dayText
  };
}

export interface ThemeGradient {
  name: string;
  gradient: string;
  subtleGradient: string;
  bgLight: string;
  text: string;
  border: string;
  tagBg: string;
  accent: string;
}

export const THEME_GRADIENTS: ThemeGradient[] = [
  {
    name: 'sunset-amber',
    gradient: 'bg-gradient-to-br from-amber-500 to-orange-600',
    subtleGradient: 'bg-gradient-to-br from-amber-500/20 via-orange-500/15 to-amber-600/20 dark:from-amber-950/60 dark:to-orange-950/60',
    bgLight: 'bg-amber-50 dark:bg-amber-950/30',
    text: 'text-amber-600 dark:text-amber-400',
    border: 'border-amber-200 dark:border-amber-800/40',
    tagBg: 'bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-200',
    accent: 'bg-amber-500 text-white',
  },
  {
    name: 'royal-indigo',
    gradient: 'bg-gradient-to-br from-indigo-500 via-purple-600 to-indigo-700',
    subtleGradient: 'bg-gradient-to-br from-indigo-500/20 via-purple-500/15 to-indigo-600/20 dark:from-indigo-950/60 dark:to-purple-950/60',
    bgLight: 'bg-indigo-50 dark:bg-indigo-950/30',
    text: 'text-indigo-600 dark:text-indigo-400',
    border: 'border-indigo-200 dark:border-indigo-800/40',
    tagBg: 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-800 dark:text-indigo-200',
    accent: 'bg-indigo-600 text-white',
  },
  {
    name: 'emerald-teal',
    gradient: 'bg-gradient-to-br from-emerald-500 to-teal-700',
    subtleGradient: 'bg-gradient-to-br from-emerald-500/20 via-teal-500/15 to-emerald-600/20 dark:from-emerald-950/60 dark:to-teal-950/60',
    bgLight: 'bg-emerald-50 dark:bg-emerald-950/30',
    text: 'text-emerald-600 dark:text-emerald-400',
    border: 'border-emerald-200 dark:border-emerald-800/40',
    tagBg: 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-800 dark:text-emerald-200',
    accent: 'bg-emerald-600 text-white',
  },
  {
    name: 'rose-ruby',
    gradient: 'bg-gradient-to-br from-rose-500 to-pink-600',
    subtleGradient: 'bg-gradient-to-br from-rose-500/20 via-pink-500/15 to-rose-600/20 dark:from-rose-950/60 dark:to-pink-950/60',
    bgLight: 'bg-rose-50 dark:bg-rose-950/30',
    text: 'text-rose-600 dark:text-rose-400',
    border: 'border-rose-200 dark:border-rose-800/40',
    tagBg: 'bg-rose-100 dark:bg-rose-900/50 text-rose-800 dark:text-rose-200',
    accent: 'bg-rose-500 text-white',
  },
  {
    name: 'ocean-cyan',
    gradient: 'bg-gradient-to-br from-blue-500 via-sky-600 to-cyan-600',
    subtleGradient: 'bg-gradient-to-br from-blue-500/20 via-cyan-500/15 to-blue-600/20 dark:from-blue-950/60 dark:to-cyan-950/60',
    bgLight: 'bg-sky-50 dark:bg-sky-950/30',
    text: 'text-sky-600 dark:text-sky-400',
    border: 'border-sky-200 dark:border-sky-800/40',
    tagBg: 'bg-sky-100 dark:bg-sky-900/50 text-sky-800 dark:text-sky-200',
    accent: 'bg-sky-600 text-white',
  },
  {
    name: 'violet-fuchsia',
    gradient: 'bg-gradient-to-br from-violet-600 to-fuchsia-600',
    subtleGradient: 'bg-gradient-to-br from-violet-500/20 via-fuchsia-500/15 to-violet-600/20 dark:from-violet-950/60 dark:to-fuchsia-950/60',
    bgLight: 'bg-violet-50 dark:bg-violet-950/30',
    text: 'text-violet-600 dark:text-violet-400',
    border: 'border-violet-200 dark:border-violet-800/40',
    tagBg: 'bg-violet-100 dark:bg-violet-900/50 text-violet-800 dark:text-violet-200',
    accent: 'bg-violet-600 text-white',
  },
  {
    name: 'forest-jade',
    gradient: 'bg-gradient-to-br from-teal-600 to-emerald-800',
    subtleGradient: 'bg-gradient-to-br from-teal-500/20 via-emerald-500/15 to-teal-600/20 dark:from-teal-950/60 dark:to-emerald-950/60',
    bgLight: 'bg-teal-50 dark:bg-teal-950/30',
    text: 'text-teal-600 dark:text-teal-400',
    border: 'border-teal-200 dark:border-teal-800/40',
    tagBg: 'bg-teal-100 dark:bg-teal-900/50 text-teal-800 dark:text-teal-200',
    accent: 'bg-teal-600 text-white',
  },
  {
    name: 'golden-sand',
    gradient: 'bg-gradient-to-br from-yellow-500 via-amber-600 to-yellow-700',
    subtleGradient: 'bg-gradient-to-br from-yellow-500/20 via-amber-500/15 to-yellow-600/20 dark:from-yellow-950/60 dark:to-amber-950/60',
    bgLight: 'bg-yellow-50 dark:bg-yellow-950/30',
    text: 'text-yellow-600 dark:text-yellow-400',
    border: 'border-yellow-200 dark:border-yellow-800/40',
    tagBg: 'bg-yellow-100 dark:bg-yellow-900/50 text-yellow-800 dark:text-yellow-200',
    accent: 'bg-yellow-500 text-white',
  },
  {
    name: 'sapphire-blue',
    gradient: 'bg-gradient-to-br from-blue-600 via-indigo-700 to-slate-800',
    subtleGradient: 'bg-gradient-to-br from-blue-500/20 via-indigo-500/15 to-blue-600/20 dark:from-blue-950/60 dark:to-indigo-950/60',
    bgLight: 'bg-blue-50 dark:bg-blue-950/30',
    text: 'text-blue-600 dark:text-blue-400',
    border: 'border-blue-200 dark:border-blue-800/40',
    tagBg: 'bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-200',
    accent: 'bg-blue-600 text-white',
  },
  {
    name: 'coral-flame',
    gradient: 'bg-gradient-to-br from-orange-500 via-rose-500 to-red-600',
    subtleGradient: 'bg-gradient-to-br from-orange-500/20 via-rose-500/15 to-orange-600/20 dark:from-orange-950/60 dark:to-rose-950/60',
    bgLight: 'bg-orange-50 dark:bg-orange-950/30',
    text: 'text-orange-600 dark:text-orange-400',
    border: 'border-orange-200 dark:border-orange-800/40',
    tagBg: 'bg-orange-100 dark:bg-orange-900/50 text-orange-800 dark:text-orange-200',
    accent: 'bg-orange-500 text-white',
  },
  {
    name: 'plum-midnight',
    gradient: 'bg-gradient-to-br from-purple-700 via-slate-800 to-indigo-950',
    subtleGradient: 'bg-gradient-to-br from-purple-500/20 via-slate-500/15 to-purple-600/20 dark:from-purple-950/60 dark:to-slate-950/60',
    bgLight: 'bg-purple-50 dark:bg-purple-950/30',
    text: 'text-purple-600 dark:text-purple-400',
    border: 'border-purple-200 dark:border-purple-800/40',
    tagBg: 'bg-purple-100 dark:bg-purple-900/50 text-purple-800 dark:text-purple-200',
    accent: 'bg-purple-700 text-white',
  },
  {
    name: 'mint-teal',
    gradient: 'bg-gradient-to-br from-teal-400 via-emerald-500 to-cyan-700',
    subtleGradient: 'bg-gradient-to-br from-teal-400/20 via-cyan-500/15 to-teal-600/20 dark:from-teal-950/60 dark:to-cyan-950/60',
    bgLight: 'bg-teal-50 dark:bg-teal-950/30',
    text: 'text-teal-600 dark:text-teal-400',
    border: 'border-teal-200 dark:border-teal-800/40',
    tagBg: 'bg-teal-100 dark:bg-teal-900/50 text-teal-800 dark:text-teal-200',
    accent: 'bg-teal-500 text-white',
  }
];

export function getThemeHash(title: string): number {
  if (!title) return 0;
  let hash = 0;
  for (let i = 0; i < title.length; i++) {
    hash = (hash << 5) - hash + title.charCodeAt(i);
    hash |= 0; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}

export function getThemeInitial(title: string): string {
  if (!title) return '✨';
  // Strip "Módulo X •" or prefixes to get the main subject initial
  const clean = title.replace(/^m[oó]dulo\s*\d+\s*•?\s*/i, '').trim();
  const firstChar = clean.charAt(0).toUpperCase();
  return firstChar || '✨';
}

export function getThemeStyle(title: string) {
  const hash = getThemeHash(title);
  const theme = THEME_GRADIENTS[hash % THEME_GRADIENTS.length];
  const initial = getThemeInitial(title);
  return {
    ...theme,
    initial,
    hash,
  };
}

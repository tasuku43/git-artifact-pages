export type ThemeMode = 'system' | 'light' | 'dark'
export type ResolvedTheme = 'light' | 'dark'

export function isThemeMode(value: string | null): value is ThemeMode {
  return value === 'light' || value === 'dark' || value === 'system'
}

export function resolveTheme(mode: ThemeMode, systemTheme: ResolvedTheme): ResolvedTheme {
  return mode === 'system' ? systemTheme : mode
}

export function toggleThemeMode(mode: ThemeMode, systemTheme: ResolvedTheme): ThemeMode {
  const activeTheme = resolveTheme(mode, systemTheme)
  return activeTheme === 'light' ? 'dark' : 'light'
}

export function themeModeIcon(mode: ThemeMode): 'sun' | 'moon' | 'monitor' {
  if (mode === 'system') return 'monitor'
  return mode === 'dark' ? 'moon' : 'sun'
}

export function themeModeActionLabel(mode: ThemeMode, activeTheme: ResolvedTheme): string {
  const nextTheme = activeTheme === 'light' ? 'dark' : 'light'
  const format = (value: string) => `${value[0].toUpperCase()}${value.slice(1)}`
  return `Theme: ${format(mode)}. Switch to ${format(nextTheme)} theme.`
}

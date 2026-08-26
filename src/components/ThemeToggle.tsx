import { Moon, Sun } from 'lucide-react';
import { useTheme } from '@/store/theme.store';
import { cn } from '@/lib/utils';

/** Alterna entre el tema oscuro y el claro. */
export default function ThemeToggle({ className }: { className?: string }) {
  const tema = useTheme((s) => s.tema);
  const alternarTema = useTheme((s) => s.alternarTema);
  const esOscuro = tema === 'dark';

  return (
    <button
      type="button"
      onClick={alternarTema}
      aria-label={esOscuro ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'}
      title={esOscuro ? 'Tema claro' : 'Tema oscuro'}
      className={cn(
        'flex items-center justify-center p-2 text-outline transition-colors hover:text-fg',
        className,
      )}
    >
      {esOscuro ? (
        <Sun size={18} strokeWidth={2} aria-hidden />
      ) : (
        <Moon size={18} strokeWidth={2} aria-hidden />
      )}
    </button>
  );
}

import {
  Anchor,
  Ban,
  BookOpen,
  BrickWall,
  ChevronsRight,
  CircleDashed,
  CheckCircle2,
  CloudLightning,
  CloudRain,
  Coffee,
  Compass,
  Flag,
  Flame,
  FlaskConical,
  Flower2,
  Gauge,
  Heart,
  Hourglass,
  Link2,
  LifeBuoy,
  ListChecks,
  MessageCirclePlus,
  MinusCircle,
  Mountain,
  OctagonX,
  Play,
  Plus,
  PlusCircle,
  Repeat,
  RotateCcw,
  Scissors,
  Search,
  Shield,
  ShieldCheck,
  Smile,
  Sprout,
  Star,
  Sun,
  Target,
  Triangle,
  TriangleAlert,
  TrendingUp,
  Weight,
  Wind,
  Wrench,
  type LucideIcon,
} from 'lucide-react';
import type { RetroColumnIconName } from '@/lib/retro-format-themes';

/** Props de um ícone de coluna: o mesmo contrato do lucide, para os dois tipos serem intercambiáveis. */
type ColumnIconProps = React.SVGProps<SVGSVGElement> & { strokeWidth?: number | string };
export type ColumnIcon = LucideIcon | ((props: ColumnIconProps) => React.JSX.Element);

/** Desenho próprio de linha 1,5 (24 px, traço currentColor) para o que o lucide não tem. */
function lineIcon(paths: string): (props: ColumnIconProps) => React.JSX.Element {
  const Icon = ({ strokeWidth = 1.5, ...rest }: ColumnIconProps) => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      <path d={paths} />
    </svg>
  );
  return Icon;
}

/** Palha: uma haste com folhas (a casinha frágil). */
export const StrawIcon = lineIcon('M12 21V3M12 8 8 5M12 8l4-3M12 13 8 10M12 13l4-3M12 18 8 15M12 18l4-3');
/** Tábua: duas tábuas de madeira empilhadas. */
export const PlanksIcon = lineIcon('M3 6h18v4H3zM3 14h18v4H3zM8 6v4M16 14v4');
/** Broto: um botão de flor fechado na haste. */
export const BudIcon = lineIcon('M12 22v-8M7 4c0 6 2 10 5 10s5-4 5-10l-3 3-2-4-2 4z');
/** Espinho: um espinho curvo com a base marcada. */
export const SpikeIcon = lineIcon('M4 20C10 18 16 12 20 4 14 6 8 12 4 20zM4 20l5-5');
/** Paraquedas: a cúpula e as cordas que seguram a carga. */
export const ParachuteIcon = lineIcon('M3 11a9 9 0 0 1 18 0c-2-1.5-4-1.5-6 0-1.5-1.2-4.5-1.2-6 0-2-1.5-4-1.5-6 0zM3 11l8.2 9M21 11l-8.2 9M12 11v9M11 20h2');

/** Ícone de cada nome usado em `RETRO_FORMAT_THEMES`. Lucide quando existe; os cinco sem equivalente são desenhos próprios. */
export const COLUMN_ICONS: Record<RetroColumnIconName, ColumnIcon> = {
  alert: TriangleAlert,
  anchor: Anchor,
  ban: Ban,
  book: BookOpen,
  bricks: BrickWall,
  bubble: MessageCirclePlus,
  bud: BudIcon,
  checkcircle: CheckCircle2,
  cloudbolt: CloudLightning,
  cloudrain: CloudRain,
  coffee: Coffee,
  compass: Compass,
  dashed: CircleDashed,
  ff: ChevronsRight,
  flag: Flag,
  flame: Flame,
  flask: FlaskConical,
  flower: Flower2,
  gauge: Gauge,
  heart: Heart,
  hourglass: Hourglass,
  lifebuoy: LifeBuoy,
  link: Link2,
  listchecks: ListChecks,
  minuscircle: MinusCircle,
  mountain: Mountain,
  parachute: ParachuteIcon,
  planks: PlanksIcon,
  play: Play,
  plus: Plus,
  pluscircle: PlusCircle,
  repeat: Repeat,
  scissors: Scissors,
  search: Search,
  shield: Shield,
  shieldcheck: ShieldCheck,
  smile: Smile,
  spike: SpikeIcon,
  sprout: Sprout,
  star: Star,
  stop: OctagonX,
  straw: StrawIcon,
  sun: Sun,
  target: Target,
  trend: TrendingUp,
  triangle: Triangle,
  undo: RotateCcw,
  weight: Weight,
  wind: Wind,
  wrench: Wrench,
};

/** Ícone de uma coluna pelo nome do mapa de temas. */
export function ColumnGlyph({ name, className }: { name: RetroColumnIconName; className?: string }) {
  const Icon = COLUMN_ICONS[name];
  return <Icon className={className} strokeWidth={1.5} aria-hidden="true" />;
}

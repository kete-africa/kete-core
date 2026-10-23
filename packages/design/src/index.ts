// The public entry point of @kete/design (doctrine D-035): two designs in three layers — base
// tokens (designs/<name>/DESIGN.md), semantic tokens (semantic.ts), components that use semantic
// tokens only. Styles: styles.css.
export { brandCss, BrandContrastError, defineBrand, type Brand, type BrandInput } from './brand.js';
export {
  Button,
  Dialog,
  dialogClassName,
  IconButton,
  labelClassName,
  Panel,
  Tag,
  TextField,
  type TagTone,
} from './components.js';
export {
  CheckField,
  ChoiceField,
  ErrorNote,
  InfoNote,
  SelectField,
  TextAreaField,
} from './fields.js';
export { checkContrasts, contrastRatio, type ContrastFailure } from './contrast.js';
export { resolvedDesigns } from './designs.gen.js';
export {
  AgentState,
  ConfirmDialog,
  EmptyState,
  UndoNotice,
  VerificationCard,
  type AgentStateName,
  type VerificationField,
} from './doctrine.js';
export {
  ChatMessage,
  ChatThread,
  Composer,
  CopyButton,
  Markdown,
  Suggestions,
  ToolCard,
} from './chat.js';
export {
  AgentRunState,
  DecisionCard,
  Mention,
  type AgentRunStateName,
  type Evidence,
} from './canvas.js';
export { BoardGrid, SummaryCard, type BoardCardSlot, type SummaryLine } from './board.js';
export { AgentCard, LessonCard, TierLadder, type AgentGesture } from './lifecycle.js';
export {
  CanvasFrame,
  FrameAskButton,
  FrameAvatar,
  FrameIconButton,
  FrameMark,
  FrameNavGroup,
  FrameNavLabel,
  FrameOrg,
  FramePage,
  FramePageHead,
  FramePlace,
  FrameSearch,
  FrameSource,
  FrameSpaceHead,
  FrameSpark,
  FrameTab,
  type PlaceExtra,
} from './canvas-frame.js';
export {
  ActorAvatar,
  faceOf,
  initialsOf,
  type ActorFace,
  type ActorKind,
  type ActorTint,
} from './actor.js';
export { CanvasIcon, isCanvasIconName, type CanvasIconName } from './canvas-icon.js';
export {
  FieldToggle,
  MessageField,
  triggered,
  type FieldFile,
  type FieldPick,
  type FieldPicked,
  type FieldTrigger,
  type MessageFieldProps,
  type MessageFieldWords,
} from './message-field.js';
export {
  ProposalList,
  VoiceCapture,
  type ProposalOutcomeState,
  type ProposalRow,
  type ProposalWords,
  type VoiceWords,
} from './proposals.js';
export {
  AgendaList,
  TeamLanes,
  WeekCalendar,
  type CalendarDay,
  type CalendarDayItem,
  type CalendarDayTone,
  type CalendarItem,
  type CalendarTone,
  type CalendarWords,
  type LaneCell,
  type LaneRow,
  type LaneTone,
} from './calendar.js';
export { KeteBand, KeteMark } from './marks.js';
export {
  applyTheme,
  THEME_COOKIE,
  themeChoices,
  themeCookie,
  themeFromCookies,
  type ThemeChoice as ThemeChoiceValue,
} from './theme.js';
export {
  CommandBar,
  DataTable,
  DetailPane,
  Drawer,
  Facts,
  FormPage,
  FormSection,
  KpiGrid,
  KpiTile,
  OrgChart,
  PageHeader,
  Row,
  RowList,
  SplitView,
  Tabs,
  ThemeChoice,
  ViewSwitcher,
  type ChartNode,
  type Column,
  type Crumb,
  type TabItem,
  type ViewOption,
} from './frame.js';
export {
  contrastPairs,
  designNames,
  semanticColors,
  semanticMappings,
  type DesignName,
  type Mode,
  type SemanticColor,
  type SemanticMapping,
} from './semantic.js';
export {
  AppCard,
  AppGrid,
  Chip,
  ChipGroup,
  Icon,
  isIconName,
  Menu,
  NavItem,
  CountBadge,
  TabBar,
  TabBarItem,
  navItemClassName,
  NavSection,
  PageSection,
  PageTitle,
  SearchField,
  Shell,
  Swatches,
  type IconName,
  type MenuItem,
} from './workspace.js';
export {
  CommandPalette,
  CommandTrigger,
  useCommandShortcut,
  type CommandGroup,
  type CommandItem,
} from './command.js';

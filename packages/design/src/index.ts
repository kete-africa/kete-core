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
export { KeteBand, KeteMark } from './marks.js';
export {
  CommandBar,
  DataTable,
  DetailPane,
  Drawer,
  Facts,
  KpiGrid,
  KpiTile,
  OrgChart,
  PageHeader,
  Row,
  RowList,
  SplitView,
  Tabs,
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
  Menu,
  NavItem,
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

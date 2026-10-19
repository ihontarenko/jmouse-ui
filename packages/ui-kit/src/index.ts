/**
 * @jmouse/ui-kit — the jMouse UI-kit. Import `@jmouse/ui-kit/styles.css` once; add a theme of your own as one more CSS
 * file after it, and one line in the catalogue handed to <AppearanceProvider>.
 */

// appearance
export {
  appearanceBootScript,
  applyAppearance,
  applyStoredAppearance,
  readStoredAppearance,
  resolveMode,
  resolveTheme,
  defaultAppearance,
  palettes,
  standardAxes,
  standardThemes,
  type AppearanceAxis,
  type AppearanceChoice,
  type AxisDefinition,
  type AxisOption,
  type Mode,
  type PaletteDefinition,
  type ThemeDefinition,
} from "./appearance/appearance"
export { AppearanceProvider, readColorToken, readToken, useAppearance, useOptionalAppearance, type AppearanceContextValue, type AppearanceProviderProperties } from "./appearance/AppearanceProvider"
export { AppearancePanel, type AppearancePanelProperties } from "./appearance/AppearancePanel"
export { AccentTonePicker, TypefacePicker } from "./appearance/Pickers"
export { AppearanceMenu, AppearanceRow, type AppearanceMenuProperties } from "./appearance/AppearanceMenu"

// icons
export { Icon, type IconProperties, type IconSource } from "./icons/Icon"
export { KitLink, LinkProvider, useKitLocation, useKitNavigate, type CurrentLocation, type LinkComponentProperties, type LinkProviderProperties } from "./lib/links"
export { iconPaths, type IconName } from "./icons/iconPaths"

// controls
export { Button, ButtonGroup, ButtonLink, IconButton, type ButtonGroupProperties, type ButtonLinkProperties, type ButtonProperties, type IconButtonProperties, type Tone } from "./controls/Button"
export { Field, FieldRow, FormGrid, FormSection, useFieldControl, type FieldProperties } from "./controls/Field"
export { FieldFromDefinition, FormFields, type FieldChoice, type FieldDefinition, type FormFieldsProperties, type FormFieldsSection, type FormValues } from "./controls/FormFields"
export { ChoiceChip, FilePicker, Radio, RadioCard, SwatchPicker, type FilePickerProperties, type RadioCardProperties, type SwatchColours, type SwatchOption, type SwatchPickerProperties } from "./controls/ChoiceCards"
export { TextArea as Textarea } from "./controls/Inputs"
export { Addon, Input, InputGroup, QuantityField, SearchField, Select, TextArea, type InputProperties, type QuantityFieldProperties, type SearchFieldProperties, type SelectOption, type SelectProperties, type TextAreaProperties } from "./controls/Inputs"
export { Checkbox, Parameter, RadioGroup, Range, Segmented, Stepper, Switch, type CheckboxProperties, type ChoiceOption, type ParameterProperties, type RadioGroupProperties, type RangeProperties, type SegmentedProperties, type StepperProperties, type SwitchProperties } from "./controls/Choices"
export { Avatar, Badge, Chip, ChipInput, Kind, KeyChord, StatusLight, Tag, Tags, type AvatarProperties, type BadgeProperties, type ChipInputProperties, type ChipProperties, type StatusLightProperties, type TagProperties } from "./controls/Labels"

export { Count, Dim, Kbd, KeySequence, Micro, Mono, Numeric, SectionTitle, type CountProperties, type SectionTitleProperties } from "./controls/Text"

// navigation
export { Breadcrumbs, Crumbs, type Crumb, type CrumbsProperties } from "./navigation/Crumbs"
export { TabPanel, Tabs, type RouteTabsProperties, type SwitchingTabsProperties, type TabDefinition, type TabItem, type TabPanelProperties, type TabsProperties } from "./navigation/Tabs"
export { EditorTabs, type EditorTabsProperties, type FileChange, type OpenFile } from "./navigation/EditorTabs"
export { Menu, MenuItem, MenuLabel, MenuSeparator, RowMenu, type MenuEntry, type MenuItemProperties, type MenuProperties, type MenuTriggerProperties } from "./navigation/Menu"
export { FilterChip, SearchInline, SegmentedControl, Toolbar, ToolbarPush, ToolbarSeparator, ToolbarSpacer, type SearchInlineProperties, type SegmentedControlProperties, type ToolbarProperties } from "./navigation/Toolbar"
export { Pager, Pagination, visiblePages, type PagerProperties, type PaginationProperties } from "./navigation/Pagination"
export { CommandPalette, matchSubsequence, useCommandShortcut, type Command, type CommandPaletteProperties } from "./navigation/CommandPalette"

// containers
export { Card, CardGrid, Disclosure, Inspector, InspectorEmpty, InspectorGroup, InspectorSection, PageHeader, Panel, Section, type CardProperties, type DisclosureProperties, type InspectorGroupProperties, type InspectorProperties, type PageHeaderProperties, type PanelProperties, type SectionProperties } from "./containers/Panel"
export { ConfirmDialog, Dialog, type ConfirmDialogProperties, type DialogProperties } from "./containers/Dialog"
export { Split, type SplitProperties } from "./containers/Split"
export { Workbench, WorkbenchGroup, WorkbenchItem, WorkbenchRail, WorkbenchViewport, type WorkbenchItemProperties, type WorkbenchViewportProperties } from "./containers/Workbench"

// data
export { DataTable, type Column, type DataTableProperties } from "./data/DataTable"
export { AsideBlock, FILE_DRAG_TYPE, PairRow, QuietEmpty, RecordAside, RecordColumns, RecordMain, SectionHead, SettingGroup, SettingList, SettingRow, Tile, TileGrid, type SettingRowProperties, type TileProperties } from "./data/Records"
export { Identity, Table, type IdentityProperties, type SortDirection, type TableColumn, type TableProperties, type TableSort } from "./data/Table"
export { Tree, type TreeNode, type TreeProperties } from "./data/Tree"
export { Code, CopyButton, Facts, Figures, InlineCode, List, ListItem, PairList, PairListItem, PathText, Progress, type CodeProperties, type CopyButtonProperties, type Fact, type FactsProperties, type Figure, type ListItemProperties, type ListProperties, type PathTextProperties, type ProgressProperties } from "./data/Values"

export { ActivityList, DateRangeField, FacetChecklist, Popover, Steps, type ActivityEntry, type DateRange, type DateRangeFieldProperties, type DateRangePreset, type Facet, type FacetOption, type FacetChecklistProperties, type PopoverProperties, type Step, type StepState } from "./data/Collections"

export { AddressRow, Meter, type AddressRowProperties, type MeterProperties } from "./data/Meter"

export { StatsBand, type StatCell, type StatsBandProperties } from "./data/StatsBand"

export { FacetDivider, FacetGroup, FacetRail, FilterRail, RailPresentationContext, type FacetGroupProperties, type FacetLink, type FilterRailItem, type FilterRailProperties } from "./data/FacetRail"
export { rowEdgeStyle, typeHue, typeHueStyle } from "./lib/typeHue"

export { RecordPicker, type RecordPickerItem, type RecordPickerProperties } from "./data/RecordPicker"

export { TreeRail, type TreeRailNode, type TreeRailProperties } from "./data/TreeRail"

// feedback
export { EmptyState, Notice, PageWaiting, ProblemState, Skeleton, Spinner, TableSkeleton, ToastProvider, Tooltip, useToast, Waiting, type WaitingProperties, type EmptyStateProperties, type NoticeProperties, type ProblemStateProperties, type ToastOptions, type TooltipProperties } from "./feedback/Feedback"

export { ErrorBoundary, ErrorPage, type ErrorBoundaryProperties, type ErrorKind, type ErrorPageProperties } from "./feedback/ErrorPage"

export { KeyboardHelp, type KeyboardHelpProperties, type ShortcutGroup, type ShortcutRow } from "./feedback/KeyboardHelp"

export { toast, Toaster, type ToastCallOptions } from "./feedback/Toaster"

// charts
export { ChartPanel, ChartThemePicker, DistributionColumns, RankedBars, TrendArea, type ChartPanelProperties, type ChartTableRow, type DistributionColumn, type DistributionColumnsProperties, type RankedBar, type RankedBarsProperties, type TrendAreaProperties, type TrendPoint } from "./charts/Charts"
export { CHART_TYPE, fitsIn, grouped, readable, scaleStep, share, shorten, useChartPalette, useMeasuredWidth, type ChartPalette } from "./charts/chartSupport"

// shell
export { AppShell, NavItem, Page, PageFill, Rail, RailGroup, StatusBar, StatusItem, Topbar, useShell, type AppShellProperties, type NavItemProperties, type PageProperties, type RailProperties, type StatusItemProperties, type TopbarProperties } from "./shell/AppShell"

// media
export { formatPlaybackTime, MediaTile, Shelf, Transport, type MediaTileProperties, type ShelfProperties, type TransportProperties } from "./media/Media"

// the IDE frame
export { Editor, FindBar, IdeFrame, TitleBar, TitleBarSeparator, ToolStripe, ToolWindow, Widget, type FindBarProperties, type FindOptions, type IdeFrameProperties, type ToolStripeProperties, type ToolWindowEntry, type ToolWindowProperties, type WidgetProperties } from "./ide/Ide"
export { CodeView, CompletionList, type CaretPosition, type CodeProblem, type CodeViewProperties, type CompletionItem, type CompletionListProperties, type LineChanges, type ProblemSeverity } from "./ide/CodeView"
export { CodeBreadcrumbs, CommitLog, EditorEmpty, type EditorEmptyProperties, Console, ConsoleCursor, ConsoleText, FileTypeGlyph, ProjectBadge, StatusMeter, TitleBarBrand, TitleBarGroup, ToolNote, ToolNotification, ToolTabs, type CodeCrumb, type CommitLogProperties, type CommitReference, type CommitRow, type ConsoleTone, type FileTypeGlyphProperties, type TitleBarBrandProperties, type ToolNotificationProperties, type ToolTabItem, type ToolTabsProperties } from "./ide/IdeParts"
export { findInSource, highlightSource, plainSourceLine, splitSourceLines, type SourceMatch, type SourceSearchOptions, type SyntaxLanguage, type SyntaxRole, type SyntaxSegment } from "./lib/syntax"

export { ApplicationShell, ContentArea, DocumentScreen, InspectorSlotProvider, ListScreen, Sidebar, SkipLink, StationList, StationNotice, StationRow, StationSection, StationShell, useInspector, useInspectorContent, useInspectorPresence, useInspectorSlot, type DocumentScreenProperties, type ListScreenProperties, type NavigationEntry, type NavigationGroup, type SidebarProperties, type StationShellProperties } from "./shell/Screens"

// helpers
export { letterOf, useGoTo, useRecordShortcuts, useShortcuts, type Shortcut } from "./lib/shortcuts"
export { EMBED_RESIZE, EmbedHost, SMALLEST_EMBED_HEIGHT, STARTING_EMBED_HEIGHT, useEmbedFrame } from "./lib/embed"
export { joinClassNames } from "./lib/classNames"
export { moveFocusAmong, placeUnderAnchor, useAnchoredPopover, type PopoverAlignment } from "./lib/anchoredPopover"

// File workspace (the original @jmouse/files manager is independent).
export { FileGlyph, fileGlyphKind, type FileGlyphKind, type FileGlyphProperties } from "./files/FileGlyph"
export { FileWorkspace, type FileWorkspaceEntry, type FileWorkspaceLabels, type FileWorkspaceLocation, type FileWorkspaceProperties, type FileWorkspaceRename } from "./files/FileWorkspace"

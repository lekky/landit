/**
 * `@landit/ui-web` — the Land The Trick design system.
 *
 * Two halves:
 * - `@landit/ui-web/styles.css`, every token and class transcribed from
 *   `design-handoff/design/Land It.html`. Import it once at the app root.
 * - the primitives below, which apply those classes.
 *
 * House rules:
 * - Fidelity is high. Zero border radius (avatars and stage dots excepted),
 *   hard offset shadows, never blurred. Recreate, don't reinterpret.
 * - Nothing here imports `@landit/core`. Primitives take colours and labels as
 *   props; the game rules stay in `core` and reach the UI through screens.
 * - Additive-only once merged: add an export or an optional prop, never change
 *   what an existing one means.
 */

export const UI_WEB_PACKAGE = '@landit/ui-web' as const;

export { cx } from './cx';

export { contrastRatio, foregroundFor, softFill } from './contrast';

export { ICONS, ICON_NAMES, Icon, type IconName, type IconProps } from './icons';

export {
  Equipment,
  SPORT_ART,
  SPORT_ART_BASE_PATH,
  SPORT_ART_NAMES,
  hasSportArt,
  sportArtSrc,
  sportArtSrcSet,
  type EquipmentProps,
  type SportArtName,
} from './sport-art';

export {
  FEEL_ART,
  SESSION_ART_BASE_PATH,
  SESSION_ART_FILES,
  SESSION_ART_SIZES,
  SESSION_ART_WIDTHS,
  SessionArt,
  WEATHER_ART,
  sessionArtSrc,
  sessionArtSrcSet,
  type SessionArtProps,
} from './session-art';

export {
  STICKER_ART_BASE_PATH,
  STICKER_ART_SIZES,
  STICKER_ART_WIDTHS,
  stickerArtSrc,
  stickerArtSrcSet,
} from './sticker-art';

export {
  AVATARS,
  AVATAR_GROUPS,
  AVATAR_BASE_PATH,
  avatarById,
  avatarSrc,
  avatarsInGroup,
  type Avatar as AvatarRecord,
  type AvatarGroupId,
  type AvatarId,
} from './avatars';

export { Avatar, type AvatarProps } from './components/Avatar';
export {
  Button,
  Pill,
  Tag,
  type ButtonProps,
  type ButtonVariant,
  type PillProps,
  type TagProps,
} from './components/buttons';
export {
  Bar,
  Difficulty,
  SegmentedProgress,
  StageDot,
  type BarProps,
  type DifficultyProps,
  type SegmentedProgressProps,
  type StageDotProps,
} from './components/meters';
export {
  SportChip,
  Tabs,
  type SportChipProps,
  type TabItem,
  type TabsProps,
} from './components/nav';
export {
  Dropdown,
  Modal,
  Sheet,
  Toast,
  ToastStack,
  type DropdownProps,
  type ModalProps,
  type SheetProps,
  type ToastProps,
  type ToastStackProps,
} from './components/overlays';
export { useModalLayer } from './components/modal-layer';
export {
  ShareCard,
  type ShareCardProps,
  type SharePoster,
  type ShareMethod,
  type ShareTrickLook,
} from './components/ShareCard';
export {
  SHARE_POSTER_HEIGHT,
  SHARE_POSTER_WIDTH,
  drawSharePoster,
  type SharePosterSpec,
} from './components/share-poster';
export { StickerBadge, type StickerBadgeProps, type StickerLook } from './components/StickerBadge';
export {
  CLIP_PLATFORM_LOOK,
  ClipPoster,
  FEEL_FACES,
  FEEL_FACE_NAMES,
  FeelFace,
  FeelSwatch,
  HardCard,
  MetaChip,
  PlatformBadge,
  SegmentedPicker,
  StageMove,
  StagePill,
  TrickPill,
  VISIBILITY_ICONS,
  VisibilityLabel,
  WEATHER_ICONS,
  WEATHER_ICON_NAMES,
  WeatherIcon,
  type ClipPlatformName,
  type ClipPosterProps,
  type FeelFaceName,
  type FeelFaceProps,
  type FeelSwatchProps,
  type HardCardProps,
  type HardShadow,
  type MetaChipProps,
  type PlatformBadgeProps,
  type SegmentedOption,
  type SegmentedPickerProps,
  type StageLookProps,
  type StageMoveProps,
  type StagePillProps,
  type TrickPillProps,
  type VisibilityLabelProps,
  type VisibilityName,
  type WeatherIconName,
  type WeatherIconProps,
} from './components/sessions';
export {
  Empty,
  Panel,
  SectionHead,
  Slot,
  type EmptyProps,
  type PanelProps,
  type SectionHeadProps,
  type SlotProps,
} from './components/surfaces';
export {
  SkillNode,
  StagePicker,
  TrickCard,
  type CategoryLook,
  type SkillNodeProps,
  type SkillNodeState,
  type SportLook,
  type StageLook,
  type StagePickerProps,
  type TrickCardProps,
} from './components/tricks';

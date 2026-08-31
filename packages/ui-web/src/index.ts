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

export { ICONS, ICON_NAMES, Icon, type IconName, type IconProps } from './icons';

export {
  Equipment,
  SPORT_ART,
  SPORT_ART_BASE_PATH,
  SPORT_ART_NAMES,
  hasSportArt,
  sportArtSrc,
  type EquipmentProps,
  type SportArtName,
} from './sport-art';

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
  Modal,
  Toast,
  ToastStack,
  type ModalProps,
  type ToastProps,
  type ToastStackProps,
} from './components/overlays';
export { ShareCard, type ShareCardProps, type ShareTrickLook } from './components/ShareCard';
export { StickerBadge, type StickerBadgeProps, type StickerLook } from './components/StickerBadge';
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

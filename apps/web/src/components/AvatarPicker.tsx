'use client';

import { AVATAR_GROUPS } from '@landit/core';
import { AVATARS, Avatar, Button, Modal, avatarsInGroup, type AvatarGroupId } from '@landit/ui-web';

import styles from './avatarPicker.module.css';

/**
 * All 36 avatars, grouped the way the set is documented: Lids, Heads, Kit.
 *
 * There is no upload. A photograph of a child is the single riskiest thing this
 * product could hold, and the illustrated set means the question never arises —
 * it is a design decision from the handoff, not a missing feature.
 */
export function AvatarPicker({
  value,
  name,
  onPick,
  onClose,
}: {
  value: string | null;
  name: string;
  onPick: (id: string | null) => void;
  onClose: () => void;
}) {
  return (
    <Modal onClose={onClose} width={560} label="Pick your picture">
      <div className={styles.pickerBody}>
        <div className={styles.pickerHead}>
          <span className="d" style={{ fontSize: 22 }}>
            Pick your picture
          </span>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Done
          </Button>
        </div>

        <div className={styles.initialRow}>
          <Avatar avatarId={null} name={name} size={44} ringWidth={value ? 2.5 : 3.5} />
          <Button variant="ghost" size="sm" onClick={() => onPick(null)} disabled={!value}>
            Use my initial
          </Button>
        </div>

        {AVATAR_GROUPS.map((group) => (
          <div key={group.id}>
            <div className={`lab ${styles.pickerGroup}`}>{group.id}</div>
            <p className={`cond ${styles.pickerName}`} style={{ textAlign: 'left', margin: 0 }}>
              {group.blurb}
            </p>
            <div className={styles.pickerGrid}>
              {avatarsInGroup(group.id as AvatarGroupId).map((avatar) => (
                <button
                  key={avatar.id}
                  type="button"
                  className={styles.pickerCell}
                  onClick={() => onPick(avatar.id)}
                  aria-pressed={value === avatar.id}
                  title={avatar.name}
                >
                  <Avatar
                    avatarId={avatar.id}
                    size={48}
                    ringWidth={value === avatar.id ? 3.5 : 2.5}
                    ring={value === avatar.id ? 'var(--orange)' : 'var(--ink)'}
                  />
                  <span className={`cond ${styles.pickerName}`}>{avatar.name}</span>
                </button>
              ))}
            </div>
          </div>
        ))}

        <p className={`cond ${styles.pickerName}`} style={{ marginTop: 14 }}>
          {AVATARS.length} to choose from. You can change it whenever you like.
        </p>
      </div>
    </Modal>
  );
}

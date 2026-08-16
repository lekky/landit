'use client';

import { SPORTS, type EventKind } from '@landit/core';
import { Button, Empty, Icon, Panel, Pill, SportChip, Tag, type IconName } from '@landit/ui-web';
import { useMemo, useState, useTransition } from 'react';

import { SportSwitch } from '@/components/shell/SportSwitch';
import { useModal } from '@/providers/modal';
import { useSport } from '@/providers/sport';
import { useToast } from '@/providers/toast';

import { setAttendanceAction } from './actions';
import styles from './events.module.css';
import type { EventsView, EventView } from './view';

/**
 * Events (screenshot 18).
 *
 * The filter row and the detail modal are the prototype's, with two
 * differences worth naming:
 *
 * - **The list is filtered in the browser**, over rows the server shaped. It is
 *   a handful of events; a round trip per pill would make the row feel broken.
 * - **A past event is dimmed rather than dropped.** "What's coming up" is the
 *   heading, but a rider who said they were going to something last weekend
 *   should still see it — silently removing a row a child ticked reads as a
 *   bug. The default filter hides them; one pill brings them back.
 *
 * Nobody else's attendance is anywhere on this screen, by design: there is no
 * stranger-contact surface in this product (plan §6.1), and a list of who else
 * is going to a park on Saturday would be one.
 */

export function EventsScreen({ view }: { readonly view: EventsView }) {
  const { sport } = useSport();
  const { openModal, closeModal } = useModal();
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();

  const [kind, setKind] = useState<EventKind | null>(null);
  const [mySportOnly, setMySportOnly] = useState(true);
  const [showPast, setShowPast] = useState(false);
  const [going, setGoing] = useState<ReadonlySet<string>>(
    () => new Set(view.events.filter((e) => e.going).map((e) => e.id)),
  );

  const list = useMemo(
    () =>
      view.events.filter((event) => {
        if (kind && event.kind !== kind) return false;
        if (mySportOnly && !event.sportIds.includes(sport)) return false;
        if (!showPast && event.past) return false;
        return true;
      }),
    [view.events, kind, mySportOnly, showPast, sport],
  );

  const toggle = (event: EventView) => {
    const next = !going.has(event.id);
    // Optimistic, then reconciled: the server action is the authority and puts
    // it back if the consent gate refuses.
    setGoing((current) => {
      const copy = new Set(current);
      if (next) copy.add(event.id);
      else copy.delete(event.id);
      return copy;
    });

    startTransition(async () => {
      const result = await setAttendanceAction(event.id, next);
      if (result.error) {
        setGoing((current) => {
          const copy = new Set(current);
          if (next) copy.delete(event.id);
          else copy.add(event.id);
          return copy;
        });
        toast(result.error, 'var(--red)');
        return;
      }
      toast(next ? `You're down for ${event.name}.` : `Taken off ${event.name}.`, event.kindColor);
    });
  };

  const openDetails = (event: EventView) => {
    openModal(
      <EventDetail
        event={event}
        going={going.has(event.id)}
        onToggle={() => {
          toggle(event);
          closeModal();
        }}
        onClose={closeModal}
      />,
      { width: 460, label: event.name },
    );
  };

  const goingCount = going.size;

  return (
    <div className={styles.page}>
      <SportSwitch note={(id) => `${view.countBySport[id] ?? 0} on`} label="Events by sport" />

      <div className={styles.headRow}>
        <div>
          <span className="eyebrow">Events</span>
          <h1 className={`d ${styles.head}`}>What&rsquo;s coming up</h1>
        </div>
        <p className={styles.lede}>
          Comps, coached sessions and one-skill classes near you. Staff add them, so the list stays
          real.
        </p>
      </div>

      <div className={styles.filters}>
        <Pill on={kind === null} onClick={() => setKind(null)}>
          Everything
        </Pill>
        {view.kinds.map((k) => (
          <Pill
            key={k.id}
            on={kind === k.id}
            onClick={() => setKind(k.id)}
            style={kind === k.id ? { background: k.color, color: '#fff' } : undefined}
          >
            {k.id}
          </Pill>
        ))}
        <span className={styles.spacer} />
        <Pill on={showPast} onClick={() => setShowPast((v) => !v)}>
          {showPast ? 'Including past' : 'Upcoming only'}
        </Pill>
        <Pill on={mySportOnly} onClick={() => setMySportOnly((v) => !v)}>
          {mySportOnly ? `Good for ${SPORTS[sport].short}` : 'Every sport'}
        </Pill>
      </div>

      {list.length ? (
        <div className={styles.list}>
          {list.map((event) => (
            <Panel
              flat
              key={event.id}
              className={`${styles.row} ${event.past ? styles.rowPast : ''}`}
            >
              <div className={styles.date} style={{ background: event.kindColor }}>
                <span className={`d ${styles.dateDay}`}>{event.day}</span>
                <span className={`lab ${styles.dateMonth}`}>{event.month}</span>
              </div>

              <div className={styles.rowBody}>
                <div className={styles.rowMain}>
                  <div className={styles.chips}>
                    <Tag color={event.kindColor} style={{ fontSize: 10 }}>
                      {event.kind}
                    </Tag>
                    {event.sports.map((s) => (
                      <SportChip
                        key={s.id}
                        small
                        sport={{ label: s.label, color: s.color, icon: s.icon as IconName }}
                      />
                    ))}
                    {event.past && <span className={`lab ${styles.muted}`}>Been and gone</span>}
                  </div>
                  <div className={`d ${styles.name}`}>{event.name}</div>
                  <div className={`lab ${styles.meta}`}>
                    {event.venue} · {event.town} · {event.level}
                  </div>
                </div>

                <div className={styles.money}>
                  <div className={`cond ${styles.price}`}>{event.price}</div>
                  <div className={`lab ${styles.muted}`}>{event.places}</div>
                </div>

                <div className={styles.actions}>
                  <Button size="sm" variant="ghost" onClick={() => openDetails(event)}>
                    Details
                  </Button>
                  <Button
                    size="sm"
                    disabled={pending}
                    onClick={() => toggle(event)}
                    style={going.has(event.id) ? { background: 'var(--green)' } : undefined}
                    aria-pressed={going.has(event.id)}
                  >
                    {going.has(event.id) ? '✓ Going' : "I'm going"}
                  </Button>
                </div>
              </div>
            </Panel>
          ))}
        </div>
      ) : (
        <Empty
          icon="flag"
          title="Nothing listed yet"
          sub={`No ${SPORTS[sport].short.toLowerCase()} events on the calendar for that filter. Try every sport, or check back.`}
          cta="Show everything"
          onCta={() => {
            setKind(null);
            setMySportOnly(false);
          }}
        />
      )}

      {goingCount > 0 && (
        <Panel className={styles.tally}>
          <span className={styles.tallyIcon}>
            <Icon name="flag" size={21} strokeWidth={2.3} />
          </span>
          <div className={styles.tallyBody}>
            <div className={`cond ${styles.tallyHead}`}>
              You&rsquo;re down for {goingCount} event{goingCount === 1 ? '' : 's'}
            </div>
            <p className={styles.tallyNote}>
              Entry and payment happen at the venue for now. We&rsquo;ll add booking once organisers
              are on board.
            </p>
          </div>
        </Panel>
      )}
    </div>
  );
}

function EventDetail({
  event,
  going,
  onToggle,
  onClose,
}: {
  readonly event: EventView;
  readonly going: boolean;
  readonly onToggle: () => void;
  readonly onClose: () => void;
}) {
  return (
    <div>
      <div className={styles.modalHead} style={{ background: event.kindColor }}>
        <div className={styles.chips}>
          <Tag color="var(--ink)">{event.kind}</Tag>
          {event.sports.map((s) => (
            <Tag key={s.id} color="var(--paper)" className={styles.tagInk}>
              {s.label}
            </Tag>
          ))}
        </div>
        <div className={`d ${styles.modalTitle}`}>{event.name}</div>
        <div className={`lab ${styles.modalDate}`}>{event.fullDate}</div>
      </div>

      <div className={styles.modalBody}>
        {event.blurb && <p className={styles.modalBlurb}>{event.blurb}</p>}
        <div className={styles.facts}>
          {(
            [
              ['Where', `${event.venue}, ${event.town}`],
              ['Who for', event.level],
              ['Cost', event.price],
              ['Places', event.places],
            ] as const
          ).map(([label, value]) => (
            <div key={label}>
              <div className={`lab ${styles.muted}`}>{label}</div>
              <div className={`cond ${styles.factValue}`}>{value}</div>
            </div>
          ))}
        </div>
        <div className={styles.modalActions}>
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
          <Button
            className={styles.push}
            onClick={onToggle}
            style={going ? { background: 'var(--green)' } : undefined}
          >
            {going ? "✓ You're going" : "I'm going"}
          </Button>
        </div>
      </div>
    </div>
  );
}

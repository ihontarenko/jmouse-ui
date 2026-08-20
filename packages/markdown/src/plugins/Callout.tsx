import type { FC, ReactNode } from 'react';
import s from './blocks.module.css';

/**
 * An admonition box — the thing `:::info` renders, usable without a Markdown document around it.
 *
 * <p>It lives here rather than inside {@code calloutPlugin} because the same four sentences get said
 * on ordinary screens: <em>nothing is configured yet</em>, <em>this will not do what you expect</em>,
 * <em>here is the way round it</em>. Every one of those written as a fresh div is a fifth shade of
 * blue that has to be kept in step with the other four by hand, so a page imports this instead.
 */

export type CalloutStyle = 'note' | 'info' | 'tip' | 'warning';

/** The mark each style wears when the caller does not name one. */
export const CALLOUT_ICONS: Readonly<Record<CalloutStyle, string>> = {
    note:    'ℹ',
    info:    'ℹ',
    tip:     '💡',
    warning: '⚠',
};

const STYLE_CLASS: Readonly<Record<CalloutStyle, string>> = {
    note:    s.calloutNote,
    info:    s.calloutInfo,
    tip:     s.calloutTip,
    warning: s.calloutWarning,
};

export interface CalloutProperties {
    /** Which of the four voices this is; `note` when unsaid. */
    readonly style?:     CalloutStyle;
    /** Overrides the style's own mark — a directive may carry its own. */
    readonly icon?:      ReactNode;
    /** Extra classes for the box, for the rare page that needs its own spacing. */
    readonly className?: string;
    readonly children:   ReactNode;
}

export const Callout: FC<CalloutProperties> = ({ style = 'note', icon, className, children }) => (
    <div className={[s.callout, STYLE_CLASS[style], className].filter(Boolean).join(' ')}>
        <span className={s.calloutIcon} aria-hidden="true">{icon ?? CALLOUT_ICONS[style]}</span>
        <div className={s.calloutText}>{children}</div>
    </div>
);

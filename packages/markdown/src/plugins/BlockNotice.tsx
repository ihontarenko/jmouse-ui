import type { FC, ReactNode } from 'react';
import s from './blocks.module.css';

/**
 * What a block shows when it cannot render: the directive as written, a badge naming the reason, and a
 * sentence saying what to do about it.
 *
 * <p>Shown rather than hidden, always. A block that silently disappears reads as "nothing to report",
 * which is a lie about a document whose whole promise is that its numbers are live.
 */
export const BlockNotice: FC<{ badge: string; directive: string; children: ReactNode }> = ({
    badge, directive, children,
}) => (
    <div className={s.notice}>
        <span className={s.noticeBadge}>{badge}</span>
        <span className={s.noticeText}><code>{directive}</code> — {children}</span>
    </div>
);

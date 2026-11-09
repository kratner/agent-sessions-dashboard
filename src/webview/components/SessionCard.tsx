import type { KeyboardEvent } from 'react';
import type { AgentSession } from '../../shared/types';
import { folderName, timeAgo } from '../format';
import { Highlight } from './Highlight';

interface Props {
  session: AgentSession;
  now: number;
  terms: string[];
  onOpen(session: AgentSession): void;
  onCopyResume(session: AgentSession): void;
  onRemove(session: AgentSession): void;
  onUnhide(session: AgentSession): void;
}

export function SessionCard({ session, now, terms, onOpen, onCopyResume, onRemove, onUnhide }: Props) {
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onOpen(session);
    }
  };
  return (
    <article
      className={`card state-${session.state}${session.hidden ? ' is-hidden' : ''}`}
      role="button"
      tabIndex={0}
      title={session.cwd}
      onClick={() => onOpen(session)}
      onKeyDown={onKeyDown}
    >
      <div className="card-title">
        <Highlight text={session.title} terms={terms} />
      </div>
      {session.hidden ? null : (
        <button
          className="card-remove"
          title="Remove from the board (hide it, or end its process)"
          aria-label={`Remove ${session.title}`}
          onClick={(e) => {
            e.stopPropagation();
            onRemove(session);
          }}
          onKeyDown={(e) => e.stopPropagation()}
        >
          ×
        </button>
      )}
      {session.state === 'waiting' && session.waitingFor ? (
        <div className="card-waiting">
          Waiting for: <Highlight text={session.waitingFor} terms={terms} />
        </div>
      ) : null}
      {session.lastPrompt ? (
        <div className="card-prompt">
          <Highlight text={session.lastPrompt} terms={terms} />
        </div>
      ) : (
        <div className="card-prompt no-prompt">No prompts yet</div>
      )}
      <div className="card-meta">
        <span className="folder">
          <Highlight text={folderName(session.cwd)} terms={terms} />
        </span>
        {session.surface ? (
          <span className="badge">
            <Highlight text={session.surface} terms={terms} />
          </span>
        ) : null}
        <span className="time">{timeAgo(session.updatedAt, now)}</span>
        {session.state === 'ended' ? (
          <button
            className="link-button"
            title="Copy a terminal command that resumes this session"
            onClick={(e) => {
              e.stopPropagation();
              onCopyResume(session);
            }}
          >
            Copy resume
          </button>
        ) : null}
        {session.hidden ? (
          <button
            className="link-button"
            title="Put this session back on the board"
            onClick={(e) => {
              e.stopPropagation();
              onUnhide(session);
            }}
            onKeyDown={(e) => e.stopPropagation()}
          >
            Unhide
          </button>
        ) : null}
      </div>
    </article>
  );
}

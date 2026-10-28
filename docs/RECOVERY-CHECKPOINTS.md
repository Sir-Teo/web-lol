# Automatic recovery checkpoints

The game keeps one automatic recovery checkpoint separately from the manual
save for each scene. During active play it attempts a backup every thirty
simulation seconds. Pausing, losing focus/visibility, graphics interruption and
the match result also capture new progress, including accepted commands at the
same simulation tick. Identical paused snapshots are not rewritten. Completed storage transactions
survive reload; a browser terminating before a write completes can still lose
the most recent progress.

Open **Escape → Match files → Preview recovery checkpoint** to review its mode,
match time and result. **Load this match** explicitly replaces the current match
and manual save. A recovery preview uses the same version, battlefield and
private-scene checks as an imported file. Missing or corrupt backups leave the
current match and manual save unchanged.

Startup continues to restore the manual save. If a recovery checkpoint exists,
the game opens paused and points to Match files, including when there is no
manual save. It keeps the recovery bytes available for review. Resuming play
continues the currently displayed match and later backups follow that branch.

Manual Save, New match, Restart and imported/recovered loads wait for an
in-flight backup. On success, the new manual save and deletion of the previous
backup share one IndexedDB transaction. A failed replacement aborts both changes.
Starting or loading another match prevents the outgoing page from writing a
late backup before its reload. Backup failures are reported without blocking
manual saving; repeated failed attempts avoid repeated toasts until a backup
succeeds. At most one backup is in flight, with no queue of serialized worlds.

Recovery checkpoints use the ordinary snapshot format and trusted scene
admission. There is no migration or change to simulation state. The private
Baron slot stays separate from ordinary practice. Local storage remains local
to the browser; use Download current match to keep a separate file.

The [verification ledger](reference/recovery-checkpoints-verification.json)
records queue, failure, transactional-abort, browser continuation and production
checks. Earlier full unit results and historical match audits retain their
original scopes.

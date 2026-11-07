import { OfflinePack } from '../storage/offline-pack';

export function mountOfflinePack(host: HTMLElement): () => void {
  host.innerHTML = `<p class="practice-note offline-status" role="status" aria-live="polite" tabindex="-1">Checking offline files…</p>
    <progress class="offline-progress" aria-label="Game pack download" hidden></progress>
    <p class="practice-note offline-size"></p>
    <button class="primary-button" data-offline="download" disabled>Download game pack</button>
    <button class="menu-button" data-offline="cancel" hidden>Cancel download</button>
    <button class="menu-button" data-offline="reload" hidden>Reload cached game</button>
    <button class="menu-button" data-offline="remove" disabled>Remove offline files</button>
    <p class="practice-note">Downloading keeps the match paused. Reloading replaces the running match; save it first to restore it. Offline files can be evicted by your browser. Removing them keeps your saved matches.</p>`;
  const status = host.querySelector<HTMLElement>('.offline-status')!;
  const size = host.querySelector<HTMLElement>('.offline-size')!;
  const bar = host.querySelector<HTMLProgressElement>('progress')!;
  const button = (name: string) =>
    host.querySelector<HTMLButtonElement>(`[data-offline="${name}"]`)!;
  let pendingFocus: HTMLButtonElement | null = null;
  const setActionDisabled = (name: string, disabled: boolean) => {
    const action = button(name);
    if (disabled && document.activeElement === action) {
      pendingFocus = action;
      status.focus({ preventScroll: true });
    }
    action.disabled = disabled;
    if (!disabled && pendingFocus === action) {
      if (document.activeElement === status && action.isConnected && !action.hidden)
        action.focus({ preventScroll: true });
      pendingFocus = null;
    }
  };
  const setFileActionsDisabled = (disabled: boolean) => {
    for (const name of ['download', 'remove', 'reload']) setActionDisabled(name, disabled);
  };
  const mb = (value: number) => `${(value / 1e6).toFixed(1)} MB`;
  if (
    !import.meta.env.PROD ||
    !isSecureContext ||
    !('serviceWorker' in navigator) ||
    !('caches' in globalThis)
  ) {
    status.textContent = 'Offline packs require a production build on HTTPS or localhost.';
    return () => {};
  }
  const pack = new OfflinePack(new URL('./', document.baseURI));
  let disposed = false;
  // Loading the manifest alone does not establish that its cache check succeeded.
  let checked = false;
  const error = (caught: unknown) => {
    if (!disposed) {
      status.textContent =
        caught instanceof Error
          ? caught.message
          : 'Offline files could not be prepared. Connect and retry.';
      if (!checked) {
        button('download').disabled = false;
        button('download').textContent = 'Retry pack check';
      }
    }
  };
  async function check() {
    const state = await pack.check();
    if (disposed) return;
    checked = true;
    size.textContent = `Full game pack: ${mb(pack.manifest!.bytes)} · ${pack.manifest!.files.length} files. Includes the source-quality assets.`;
    status.textContent = state.complete
      ? 'Ready for offline use on this browser.'
      : `${mb(state.bytes)} of verified files available. Download the complete pack before going offline.`;
    button('download').disabled = false;
    button('download').textContent = state.complete
      ? 'Check and repair game pack'
      : 'Download game pack';
    button('reload').hidden = !state.complete;
    button('remove').disabled = false;
  }
  void check().catch(error);
  button('download').onclick = async () => {
    if (!checked) {
      setActionDisabled('download', true);
      status.textContent = 'Checking offline files…';
      try {
        await check();
      } catch (caught) {
        error(caught);
      } finally {
        if (!disposed) setActionDisabled('download', false);
      }
      return;
    }
    setFileActionsDisabled(true);
    button('reload').hidden = true;
    button('cancel').hidden = false;
    button('cancel').focus();
    bar.hidden = false;
    status.textContent = 'Downloading and verifying game files…';
    try {
      await pack.download((progress) => {
        if (disposed) return;
        bar.max = progress.totalBytes;
        bar.value = progress.bytes;
        status.textContent = `${mb(progress.bytes)} / ${mb(progress.totalBytes)} · ${progress.completed} / ${progress.total} files verified`;
      });
      await check();
    } catch (caught) {
      error(caught);
    } finally {
      if (!disposed) {
        setFileActionsDisabled(false);
        const cancelFocused = document.activeElement === button('cancel');
        button('cancel').hidden = true;
        bar.hidden = true;
        if (cancelFocused) button('download').focus();
      }
    }
  };
  button('cancel').onclick = () => pack.cancel();
  button('reload').onclick = async () => {
    setFileActionsDisabled(true);
    status.textContent = 'Preparing cached game reload…';
    try {
      await pack.reload();
    } catch (caught) {
      error(caught);
    } finally {
      if (!disposed) setFileActionsDisabled(false);
    }
  };
  button('remove').onclick = async () => {
    setFileActionsDisabled(true);
    status.textContent = 'Removing offline files…';
    try {
      await pack.remove();
      if (!disposed) {
        status.textContent = 'Offline files removed. Saved matches were kept.';
        button('reload').hidden = true;
      }
    } catch (caught) {
      error(caught);
    } finally {
      if (!disposed) setFileActionsDisabled(false);
    }
  };
  return () => {
    disposed = true;
    pack.cancel();
  };
}

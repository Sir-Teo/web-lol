export interface PackFile {
  path: string;
  bytes: number;
  sha256: string;
}
export interface OfflineManifest {
  format: 1;
  id: string;
  workerPolicySha256: string;
  bytes: number;
  files: PackFile[];
}
export interface PackProgress {
  completed: number;
  total: number;
  bytes: number;
  totalBytes: number;
}

export function parseOfflineManifest(value: unknown): OfflineManifest {
  if (!value || typeof value !== 'object') throw new Error('The game pack manifest is invalid.');
  const pack = value as OfflineManifest;
  const digest = (value: unknown) => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
  if (
    pack.format !== 1 ||
    !digest(pack.id) ||
    !digest(pack.workerPolicySha256) ||
    !Array.isArray(pack.files) ||
    !pack.files.length ||
    pack.files.length > 10000 ||
    !Number.isSafeInteger(pack.bytes) ||
    pack.bytes <= 0
  )
    throw new Error('The game pack manifest is invalid.');
  const paths = new Set<string>();
  let bytes = 0;
  for (const file of pack.files) {
    if (
      !file ||
      typeof file.path !== 'string' ||
      !/^[a-zA-Z0-9_./-]+$/.test(file.path) ||
      file.path.startsWith('/') ||
      file.path.split('/').some((part) => !part || part === '.' || part === '..') ||
      paths.has(file.path) ||
      !Number.isSafeInteger(file.bytes) ||
      file.bytes < 0 ||
      !digest(file.sha256)
    )
      throw new Error('The game pack manifest is invalid.');
    paths.add(file.path);
    bytes += file.bytes;
  }
  if (bytes !== pack.bytes || !Number.isSafeInteger(bytes) || !paths.has('index.html'))
    throw new Error('The game pack manifest is invalid.');
  return pack;
}

interface PackEnvironment {
  storage: CacheStorage;
  fetch: typeof fetch;
  enable: () => Promise<void>;
  installed?: (id: string) => Promise<boolean>;
  waiting?: () => Promise<string | null>;
}

export class OfflinePack {
  manifest: OfflineManifest | null = null;
  busy = false;
  private abort: AbortController | null = null;
  private env: PackEnvironment;
  private base: URL;
  constructor(base: URL, environment?: PackEnvironment) {
    this.base = new URL('./', base);
    this.env = environment ?? {
      storage: caches,
      fetch: fetch.bind(globalThis),
      enable: async () => {
        const existing = await navigator.serviceWorker.getRegistration(this.base.href);
        const current =
          existing?.scope === this.base.href ? (existing.waiting ?? existing.active) : null;
        if (current && (await workerMessage(current, 'pack-id')).id === this.manifest?.id) return;
        const registration = await navigator.serviceWorker.register(
          new URL('offline-worker.js', this.base),
          {
            scope: this.base.href,
            updateViaCache: 'none',
          }
        );
        if (registration.active && !registration.installing) await registration.update();
        await waitForInstall(registration);
        if (!registration.waiting && !registration.active) await navigator.serviceWorker.ready;
        const worker = registration.waiting ?? registration.active;
        if (!worker || (await workerMessage(worker, 'pack-id')).id !== this.manifest?.id)
          throw new Error('The game version changed during download.');
      },
      installed: async (id) => {
        const registration = await navigator.serviceWorker.getRegistration(this.base.href);
        const worker =
          registration?.scope === this.base.href
            ? (registration.waiting ?? registration.active)
            : null;
        return !!worker && (await workerMessage(worker, 'pack-id')).id === id;
      },
      waiting: async () => {
        const registration = await navigator.serviceWorker.getRegistration(this.base.href);
        return registration?.scope === this.base.href && registration.waiting
          ? (await workerMessage(registration.waiting, 'pack-id')).id
          : null;
      },
    };
  }
  get prefix(): string {
    return `rift-offline-v1:${this.base.href}:`;
  }
  get cacheName(): string {
    if (!this.manifest) throw new Error('Check the game pack first.');
    return this.prefix + this.manifest.id;
  }
  private get marker(): string {
    return new URL('.offline-complete', this.base).href;
  }
  async check(): Promise<{ complete: boolean; files: number; bytes: number }> {
    if (this.busy) throw new Error('A download is already running.');
    const response = await this.env
      .fetch(new URL('offline-pack.json', this.base), {
        cache: 'no-store',
      })
      .catch(() => {
        throw new Error('The offline pack is incomplete or unavailable. Connect and try again.');
      });
    if (!response.ok) throw new Error('The offline pack is unavailable. Connect and try again.');
    this.manifest = parseOfflineManifest(await response.json());
    if (response.headers.has('x-rift-offline-manifest')) {
      const waiting = await this.env.waiting?.();
      if (waiting && waiting !== this.manifest.id) {
        const staged = await this.env.storage.open(this.prefix + waiting);
        const newer = await staged.match(new URL('offline-pack.json', this.base));
        if (newer) {
          const candidate = parseOfflineManifest(await newer.json());
          if (candidate.id === waiting) this.manifest = candidate;
        }
      }
    }
    const cache = await this.env.storage.open(this.cacheName);
    const keys = new Map((await cache.keys()).map((request) => [request.url, request]));
    let files = 0,
      bytes = 0;
    for (const file of this.manifest.files)
      if (keys.has(new URL(file.path, this.base).href)) {
        files++;
        bytes += file.bytes;
      }
    const verified = files === this.manifest.files.length && !!(await cache.match(this.marker));
    if (!verified) await cache.delete(this.marker);
    const complete =
      verified && (!this.env.installed || (await this.env.installed(this.manifest.id)));
    return { complete, files, bytes };
  }
  cancel(): void {
    this.abort?.abort();
  }
  async download(progress: (value: PackProgress) => void): Promise<void> {
    if (this.busy || !this.manifest) throw new Error('Check the game pack before downloading.');
    this.busy = true;
    const controller = new AbortController();
    this.abort = controller;
    const pack = this.manifest;
    try {
      const cache = await this.env.storage.open(this.cacheName);
      const previous = await Promise.all(
        (await this.env.storage.keys())
          .filter((name) => name.startsWith(this.prefix) && name !== this.cacheName)
          .map((name) => this.env.storage.open(name))
      );
      let completed = 0,
        bytes = 0;
      for (const file of pack.files) {
        controller.signal.throwIfAborted();
        const url = new URL(file.path, this.base);
        let verified = await verifiedResponse(await cache.match(url), file);
        if (!verified) await cache.delete(this.marker);
        if (!verified)
          for (const old of previous) {
            const reusable = await old.match(url);
            if (await verifiedResponse(reusable, file)) {
              await cache.put(url, reusable!);
              verified = true;
              break;
            }
          }
        if (!verified) {
          const response = await this.env
            .fetch(url, {
              cache: 'no-store',
              signal: controller.signal,
            })
            .catch(() => {
              throw new Error(
                `Could not download ${file.path}. Reconnect and retry; verified files are kept.`
              );
            });
          if (!response.ok || response.type === 'opaque')
            throw new Error(`Could not download ${file.path}. Retry to keep completed files.`);
          const data = await response.arrayBuffer();
          const digest = await sha256(data);
          if (data.byteLength !== file.bytes || digest !== file.sha256)
            throw new Error(
              `Game files changed or failed verification (${file.path}). Check for updates and retry.`
            );
          controller.signal.throwIfAborted();
          await cache.put(
            url,
            new Response(data, {
              headers: {
                'Content-Type': response.headers.get('content-type') ?? 'application/octet-stream',
                'Content-Length': String(data.byteLength),
                'X-Rift-SHA256': digest,
              },
            })
          );
        }
        completed++;
        bytes += file.bytes;
        progress({ completed, total: pack.files.length, bytes, totalBytes: pack.bytes });
      }
      controller.signal.throwIfAborted();
      await cache.put(
        new URL('offline-pack.json', this.base),
        new Response(JSON.stringify(pack), {
          headers: { 'Content-Type': 'application/json' },
        })
      );
      await cache.put(this.marker, new Response(pack.id));
      try {
        await this.env.enable();
      } catch {
        throw new Error(
          'Files are downloaded, but offline startup could not be enabled. Connect and retry.'
        );
      }
    } catch (error) {
      if (controller.signal.aborted)
        throw new Error('Download cancelled. Verified files are kept for retry.');
      if (error instanceof DOMException && error.name === 'QuotaExceededError')
        throw new Error('Browser storage is full. Free space and retry; completed files are kept.');
      throw error;
    } finally {
      this.abort = null;
      this.busy = false;
    }
  }
  async remove(): Promise<void> {
    if (this.busy) throw new Error('Cancel the download before removing files.');
    const registration = await navigator.serviceWorker.getRegistration(this.base.href);
    if (registration?.scope === this.base.href) await registration.unregister();
    for (const name of await this.env.storage.keys())
      if (name.startsWith(this.prefix)) await this.env.storage.delete(name);
  }
  async reload(): Promise<void> {
    if (!(await this.check()).complete)
      throw new Error('The offline pack is incomplete. Download it again before reloading.');
    const registration = await navigator.serviceWorker.getRegistration(this.base.href);
    if (!registration || registration.scope !== this.base.href)
      throw new Error('Download the game pack before reloading offline.');
    await waitForInstall(registration);
    const worker = registration.waiting ?? registration.active;
    if (!worker) throw new Error('Offline setup is still pending. Try again.');
    const response = await workerMessage(worker, 'activate-pack');
    if (response.id !== this.manifest?.id)
      throw new Error('The installed pack differs. Connect and download the current version.');
    if (navigator.serviceWorker.controller !== worker)
      await new Promise<void>((yes, no) => {
        const timer = setTimeout(() => {
          navigator.serviceWorker.removeEventListener('controllerchange', changed);
          no(new Error('The update is still activating. Try again.'));
        }, 10000);
        const changed = () => {
          clearTimeout(timer);
          navigator.serviceWorker.removeEventListener('controllerchange', changed);
          yes();
        };
        navigator.serviceWorker.addEventListener('controllerchange', changed);
        if (navigator.serviceWorker.controller === worker) changed();
      });
    location.reload();
  }
}

async function waitForInstall(registration: ServiceWorkerRegistration): Promise<void> {
  const installing = registration.installing;
  if (!installing) return;
  await new Promise<void>((yes, no) => {
    const timer = setTimeout(() => {
      installing.removeEventListener('statechange', changed);
      no(new Error('Offline setup is still pending. Try again.'));
    }, 15000);
    const changed = () => {
      if (!['installed', 'activated', 'redundant'].includes(installing.state)) return;
      clearTimeout(timer);
      installing.removeEventListener('statechange', changed);
      if (installing.state === 'redundant')
        no(new Error('The offline worker could not be installed.'));
      else yes();
    };
    installing.addEventListener('statechange', changed);
    changed();
  });
}
async function workerMessage(worker: ServiceWorker, type: string): Promise<{ id: string }> {
  const channel = new MessageChannel();
  return new Promise((yes, no) => {
    const timer = setTimeout(() => {
      channel.port1.close();
      no(new Error('Offline setup did not respond. Try again.'));
    }, 10000);
    channel.port1.onmessage = (event) => {
      clearTimeout(timer);
      channel.port1.close();
      if (event.data.error) no(new Error(event.data.error));
      else yes(event.data);
    };
    worker.postMessage({ type }, [channel.port2]);
  });
}

async function sha256(data: ArrayBuffer): Promise<string> {
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256', data))]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}
async function verifiedResponse(response: Response | undefined, file: PackFile): Promise<boolean> {
  if (
    !response ||
    response.headers.get('x-rift-sha256') !== file.sha256 ||
    response.headers.get('content-length') !== String(file.bytes)
  )
    return false;
  const bytes = await response.clone().arrayBuffer();
  return bytes.byteLength === file.bytes && (await sha256(bytes)) === file.sha256;
}

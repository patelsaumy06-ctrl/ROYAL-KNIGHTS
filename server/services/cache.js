/**
 * Lightweight in-memory LRU cache with TTL eviction.
 *
 * Designed for caching match engine results so identical
 * task+volunteer combinations don't recompute on every request.
 *
 * For production at scale, swap this for Redis with the same API
 * surface — the rest of the code stays identical.
 */
export class MemoryCache {
  /** @param {{ maxSize?: number, ttlMs?: number }} opts */
  constructor({ maxSize = 500, ttlMs = 5 * 60 * 1000 } = {}) {
    this._map = new Map();       // key → { value, expiresAt }
    this._maxSize = maxSize;
    this._ttlMs = ttlMs;
    this._hits = 0;
    this._misses = 0;
  }

  /** Return cached value or undefined. */
  get(key) {
    const entry = this._map.get(key);
    if (!entry) { this._misses++; return undefined; }
    if (Date.now() > entry.expiresAt) {
      this._map.delete(key);
      this._misses++;
      return undefined;
    }
    // Refresh insertion order (LRU touch)
    this._map.delete(key);
    this._map.set(key, entry);
    this._hits++;
    return entry.value;
  }

  /** Store a value. Evicts the oldest entry if maxSize is exceeded. */
  set(key, value) {
    if (this._map.size >= this._maxSize) {
      // Evict oldest (first inserted) key
      const oldest = this._map.keys().next().value;
      this._map.delete(oldest);
    }
    this._map.set(key, { value, expiresAt: Date.now() + this._ttlMs });
  }

  /** Invalidate a specific key. */
  del(key) { this._map.delete(key); }

  /** Flush the entire cache. */
  flush() { this._map.clear(); }

  /** Return cache statistics for monitoring. */
  stats() {
    return {
      size: this._map.size,
      maxSize: this._maxSize,
      ttlMs: this._ttlMs,
      hits: this._hits,
      misses: this._misses,
      hitRate: this._hits + this._misses > 0
        ? ((this._hits / (this._hits + this._misses)) * 100).toFixed(1) + '%'
        : 'N/A',
    };
  }
}

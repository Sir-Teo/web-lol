/** Nonblocking WebGL2 elapsed queries for diagnostics; never part of the shipped renderer. */
export class GpuTimer {
  constructor(gl, limit = 64) {
    this.gl = gl;
    this.ext = gl.getExtension('EXT_disjoint_timer_query_webgl2');
    this.limit = limit;
    this.pending = [];
    this.samples = [];
    this.discarded = 0;
    this.skipped = 0;
  }
  poll() {
    if (!this.ext) return;
    const gl = this.gl;
    if (gl.getParameter(this.ext.GPU_DISJOINT_EXT)) {
      this.discarded += this.pending.length;
      this.clear();
      return;
    }
    while (
      this.pending.length &&
      gl.getQueryParameter(this.pending[0], gl.QUERY_RESULT_AVAILABLE)
    ) {
      const query = this.pending.shift();
      const ns = gl.getQueryParameter(query, gl.QUERY_RESULT);
      if (Number.isFinite(ns) && ns >= 0) this.samples.push(ns / 1e6);
      else this.discarded++;
      gl.deleteQuery(query);
    }
  }
  begin() {
    this.poll();
    if (!this.ext) return false;
    if (this.pending.length >= this.limit) {
      this.skipped++;
      return false;
    }
    const query = this.gl.createQuery();
    if (!query) {
      this.skipped++;
      return false;
    }
    this.gl.beginQuery(this.ext.TIME_ELAPSED_EXT, query);
    this.pending.push(query);
    return true;
  }
  end() {
    this.gl.endQuery(this.ext.TIME_ELAPSED_EXT);
  }
  clear() {
    for (const query of this.pending) this.gl.deleteQuery(query);
    this.pending.length = 0;
  }
}

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GpuTimer } from './gpu-timer.mjs';

function context() {
  const queries = [],
    deleted = [];
  const gl = {
    QUERY_RESULT_AVAILABLE: 'available',
    QUERY_RESULT: 'result',
    disjoint: false,
    getExtension: () => ({ TIME_ELAPSED_EXT: 'elapsed', GPU_DISJOINT_EXT: 'disjoint' }),
    getParameter: () => gl.disjoint,
    createQuery: () => {
      const query = { available: false, result: 2e6 };
      queries.push(query);
      return query;
    },
    beginQuery() {},
    endQuery() {},
    getQueryParameter(query, key) {
      if (key === 'result')
        assert.equal(query.available, true, 'Never synchronously request an unavailable result');
      return query[key];
    },
    deleteQuery: (query) => deleted.push(query),
  };
  return { gl, queries, deleted };
}
test('unavailable extension stays explicit and starts no query', () => {
  const { gl, queries } = context();
  gl.getExtension = () => null;
  const timer = new GpuTimer(gl);
  assert.equal(timer.begin(), false);
  timer.poll();
  timer.clear();
  assert.equal(queries.length, 0);
  assert.deepEqual(timer.samples, []);
});
test('results are asynchronous, converted from nanoseconds, bounded and deleted', () => {
  const { gl, queries, deleted } = context(),
    timer = new GpuTimer(gl, 2);
  assert.equal(timer.begin(), true);
  timer.end();
  assert.equal(timer.begin(), true);
  timer.end();
  assert.equal(timer.begin(), false);
  assert.equal(timer.skipped, 1);
  queries[0].available = true;
  timer.poll();
  assert.deepEqual(timer.samples, [2]);
  assert.deepEqual(deleted, [queries[0]]);
  timer.clear();
  assert.equal(deleted.length, 2);
  assert.equal(timer.pending.length, 0);
});
test('disjoint and invalid results are discarded rather than reported as timings', () => {
  const { gl, queries, deleted } = context(),
    timer = new GpuTimer(gl);
  timer.begin();
  timer.end();
  gl.disjoint = true;
  timer.poll();
  assert.equal(timer.discarded, 1);
  assert.equal(deleted.length, 1);
  assert.deepEqual(timer.samples, []);
  gl.disjoint = false;
  timer.begin();
  timer.end();
  queries[1].available = true;
  queries[1].result = NaN;
  timer.poll();
  assert.equal(timer.discarded, 2);
  assert.equal(deleted.length, 2);
  assert.deepEqual(timer.samples, []);
});

/* Pathfinding: BFS flow field dari markas ke seluruh petak. */
(function (root) {
  const DIRS = [[1, 0], [0, 1], [0, -1], [-1, 0]];

  /* Mengembalikan jarak tiap petak ke tujuan (-1 = tak terjangkau).
     Satu kali hitung melayani semua musuh: O(lebar x tinggi). */
  function flowField(w, h, blocked, goal) {
    const dist = new Int16Array(w * h).fill(-1);
    const queue = [goal.y * w + goal.x];
    dist[queue[0]] = 0;
    for (let i = 0; i < queue.length; i++) {
      const c = queue[i], x = c % w, y = (c / w) | 0;
      for (const [dx, dy] of DIRS) {
        const nx = x + dx, ny = y + dy, n = ny * w + nx;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h || dist[n] >= 0 || blocked(nx, ny)) continue;
        dist[n] = dist[c] + 1;
        queue.push(n);
      }
    }
    return dist;
  }

  /* Petak berikutnya: tetangga berjarak terkecil; bila seri, pilih yang lurus. */
  function nextCell(dist, w, h, x, y, prev) {
    let best = null, bestScore = Infinity;
    for (const [dx, dy] of DIRS) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const d = dist[ny * w + nx];
      if (d < 0) continue;
      const straight = prev && prev.x === dx && prev.y === dy ? 0 : 0.5;
      if (d + straight < bestScore) { bestScore = d + straight; best = { x: nx, y: ny, dx, dy }; }
    }
    return best;
  }

  function trace(dist, w, h, start) {
    const out = [{ x: start.x, y: start.y }];
    let cur = start, prev = null;
    while (dist[cur.y * w + cur.x] > 0) {
      const n = nextCell(dist, w, h, cur.x, cur.y, prev);
      if (!n) break;
      out.push({ x: n.x, y: n.y });
      prev = { x: n.dx, y: n.dy };
      cur = n;
    }
    return out;
  }

  root.KPath = { flowField, nextCell, trace };
  if (typeof module !== 'undefined') module.exports = root.KPath;
})(typeof window !== 'undefined' ? window : globalThis);

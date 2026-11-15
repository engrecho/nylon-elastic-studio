// Read-only triangle proxy. Buffers are copied so neither physics nor BVH construction
// can change the displayed skin, its index buffer, or the original model.
export class StaticSkinCollider {
  constructor(positions, indices, { leafSize = 8, maxY = 2.08 } = {}) {
    this.positions = positions.slice();
    const triangles = [];
    for (let k = 0; k < indices.length; k += 3) {
      const a = indices[k], b = indices[k + 1], c = indices[k + 2];
      if (Math.min(positions[a * 3 + 1], positions[b * 3 + 1], positions[c * 3 + 1]) <= maxY)
        triangles.push(a, b, c);
    }
    this.indices = new Uint32Array(triangles);
    const count = triangles.length / 3;
    this.order = Uint32Array.from({ length: count }, (_, i) => i);
    this.centers = new Float32Array(count * 3);
    for (let t = 0; t < count; t++) for (let c = 0; c < 3; c++)
      this.centers[t * 3 + c] = (positions[triangles[t * 3] * 3 + c] + positions[triangles[t * 3 + 1] * 3 + c] + positions[triangles[t * 3 + 2] * 3 + c]) / 3;
    this.nodes = [];
    const build = (start, end) => {
      const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
      for (let q = start; q < end; q++) for (let v = 0; v < 3; v++) {
        const at = this.indices[this.order[q] * 3 + v] * 3;
        for (let c = 0; c < 3; c++) { min[c] = Math.min(min[c], this.positions[at + c]); max[c] = Math.max(max[c], this.positions[at + c]); }
      }
      const id = this.nodes.length, node = { min, max, start, end, left: -1, right: -1 };
      this.nodes.push(node);
      if (end - start > leafSize) {
        let axis = 0; for (let c = 1; c < 3; c++) if (max[c] - min[c] > max[axis] - min[axis]) axis = c;
        this.order.subarray(start, end).sort((a, b) => this.centers[a * 3 + axis] - this.centers[b * 3 + axis]);
        const middle = (start + end) >> 1; node.left = build(start, middle); node.right = build(middle, end);
      }
      return id;
    };
    if (count) build(0, count);
    this._point = new Float64Array(3);
  }

  _boxDistance(node, x, y, z) {
    let d = 0; for (let c = 0; c < 3; c++) { const p = c === 0 ? x : c === 1 ? y : z; const delta = Math.max(node.min[c] - p, 0, p - node.max[c]); d += delta * delta; } return d;
  }

  _triangle(t, x, y, z, out) {
    const p = this.positions, at = this.indices, a = at[t * 3] * 3, b = at[t * 3 + 1] * 3, c = at[t * 3 + 2] * 3;
    const ax = p[a], ay = p[a + 1], az = p[a + 2], bx = p[b], by = p[b + 1], bz = p[b + 2], cx = p[c], cy = p[c + 1], cz = p[c + 2];
    const abx = bx - ax, aby = by - ay, abz = bz - az, acx = cx - ax, acy = cy - ay, acz = cz - az;
    const apx = x - ax, apy = y - ay, apz = z - az;
    const d1 = abx * apx + aby * apy + abz * apz, d2 = acx * apx + acy * apy + acz * apz;
    let qx, qy, qz;
    if (d1 <= 0 && d2 <= 0) { qx = ax; qy = ay; qz = az; }
    else {
      const bpx = x - bx, bpy = y - by, bpz = z - bz, d3 = abx * bpx + aby * bpy + abz * bpz, d4 = acx * bpx + acy * bpy + acz * bpz;
      if (d3 >= 0 && d4 <= d3) { qx = bx; qy = by; qz = bz; }
      else {
        const vc = d1 * d4 - d3 * d2;
        if (vc <= 0 && d1 >= 0 && d3 <= 0) { const v = d1 / (d1 - d3); qx = ax + v * abx; qy = ay + v * aby; qz = az + v * abz; }
        else {
          const cpx = x - cx, cpy = y - cy, cpz = z - cz, d5 = abx * cpx + aby * cpy + abz * cpz, d6 = acx * cpx + acy * cpy + acz * cpz;
          if (d6 >= 0 && d5 <= d6) { qx = cx; qy = cy; qz = cz; }
          else {
            const vb = d5 * d2 - d1 * d6;
            if (vb <= 0 && d2 >= 0 && d6 <= 0) { const w = d2 / (d2 - d6); qx = ax + w * acx; qy = ay + w * acy; qz = az + w * acz; }
            else {
              const va = d3 * d6 - d5 * d4;
              if (va <= 0 && d4 - d3 >= 0 && d5 - d6 >= 0) { const w = (d4 - d3) / ((d4 - d3) + (d5 - d6)); qx = bx + w * (cx - bx); qy = by + w * (cy - by); qz = bz + w * (cz - bz); }
              else { const denominator = va + vb + vc; if (Math.abs(denominator) < 1e-24) return Infinity; const v = vb / denominator, w = vc / denominator; qx = ax + abx * v + acx * w; qy = ay + aby * v + acy * w; qz = az + abz * v + acz * w; }
            }
          }
        }
      }
    }
    out[0] = qx; out[1] = qy; out[2] = qz;
    return (x - qx) ** 2 + (y - qy) ** 2 + (z - qz) ** 2;
  }

  nearest(x, y, z, maxDistance = Infinity) {
    if (!this.nodes.length) return null;
    const stack = [0]; let best = maxDistance * maxDistance, triangle = -1, point;
    while (stack.length) {
      const node = this.nodes[stack.pop()]; if (this._boxDistance(node, x, y, z) > best) continue;
      if (node.left < 0) {
        for (let q = node.start; q < node.end; q++) { const t = this.order[q], distance = this._triangle(t, x, y, z, this._point); if (Number.isFinite(distance) && distance <= best) { best = distance; triangle = t; point = Array.from(this._point); } }
      } else {
        const left = this._boxDistance(this.nodes[node.left], x, y, z), right = this._boxDistance(this.nodes[node.right], x, y, z);
        if (left < right) { stack.push(node.right, node.left); } else stack.push(node.left, node.right);
      }
    }
    if (triangle < 0) return null;
    return { point, normal: this.normal(triangle), distance: Math.sqrt(best), triangle };
  }

  normal(triangle) {
    const p = this.positions, a = this.indices[triangle * 3] * 3, b = this.indices[triangle * 3 + 1] * 3, c = this.indices[triangle * 3 + 2] * 3;
    const ux = p[b] - p[a], uy = p[b + 1] - p[a + 1], uz = p[b + 2] - p[a + 2], vx = p[c] - p[a], vy = p[c + 1] - p[a + 1], vz = p[c + 2] - p[a + 2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx, length = Math.hypot(nx, ny, nz) || 1;
    return [nx / length, ny / length, nz / length];
  }

  sweep(from, to) {
    if (!this.nodes.length) return null;
    const d = [to[0] - from[0], to[1] - from[1], to[2] - from[2]], stack = [0]; let best = 1 + 1e-8, triangle = -1;
    while (stack.length) {
      const node = this.nodes[stack.pop()]; let near = 0, far = Math.min(1, best);
      for (let c = 0; c < 3; c++) {
        if (Math.abs(d[c]) < 1e-12) { if (from[c] < node.min[c] || from[c] > node.max[c]) { near = 2; break; } }
        else { let a = (node.min[c] - from[c]) / d[c], b = (node.max[c] - from[c]) / d[c]; if (a > b) [a, b] = [b, a]; near = Math.max(near, a); far = Math.min(far, b); }
      }
      if (near > far) continue;
      if (node.left >= 0) { stack.push(node.left, node.right); continue; }
      for (let q = node.start; q < node.end; q++) {
        const t = this.order[q], p = this.positions, a = this.indices[t * 3] * 3, b = this.indices[t * 3 + 1] * 3, c = this.indices[t * 3 + 2] * 3;
        const ux = p[b] - p[a], uy = p[b + 1] - p[a + 1], uz = p[b + 2] - p[a + 2], vx = p[c] - p[a], vy = p[c + 1] - p[a + 1], vz = p[c + 2] - p[a + 2];
        const hx = d[1] * vz - d[2] * vy, hy = d[2] * vx - d[0] * vz, hz = d[0] * vy - d[1] * vx, determinant = ux * hx + uy * hy + uz * hz;
        if (Math.abs(determinant) < 1e-12) continue;
        const sx = from[0] - p[a], sy = from[1] - p[a + 1], sz = from[2] - p[a + 2], u = (sx * hx + sy * hy + sz * hz) / determinant;
        if (u < 0 || u > 1) continue;
        const qx = sy * uz - sz * uy, qy = sz * ux - sx * uz, qz = sx * uy - sy * ux, v = (d[0] * qx + d[1] * qy + d[2] * qz) / determinant;
        if (v < 0 || u + v > 1) continue;
        const fraction = (vx * qx + vy * qy + vz * qz) / determinant;
        if (fraction > 1e-7 && fraction <= 1 && fraction < best) { best = fraction; triangle = t; }
      }
    }
    return triangle < 0 ? null : { fraction: best, point: from.map((x, c) => x + d[c] * best), normal: this.normal(triangle) };
  }

  constrain(previous, candidate, clearance = .014) {
    let point = Array.from(candidate), normal = null, corrected = false;
    const movement = Math.hypot(...candidate.map((x, c) => x - previous[c]));
    if (movement > clearance * .5) {
      const hit = this.sweep(previous, point);
      if (hit) { point = hit.point.map((x, c) => x + hit.normal[c] * clearance); normal = hit.normal; corrected = true; }
    }
    // A bounded nearest query covers local contact; sweeping handles deep crossings.
    for (let iteration = 0; iteration < 2; iteration++) {
      const hit = this.nearest(...point, clearance * 3);
      if (!hit) break;
      const signed = hit.normal.reduce((s, n, c) => s + n * (point[c] - hit.point[c]), 0);
      if (signed >= 0 && hit.distance >= clearance - 1e-6) break;
      // At triangle edges the face-normal projection is shorter than the actual
      // distance. Using it as the clearance creates artificial sticking ridges.
      const direction = signed >= 0 && hit.distance > 1e-9 ? point.map((x, c) => (x - hit.point[c]) / hit.distance) : hit.normal;
      point = hit.point.map((x, c) => x + direction[c] * clearance); normal = direction; corrected = true;
    }
    return { point, normal, corrected };
  }
}

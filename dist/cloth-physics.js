// This solver owns only clothing buffers. Skin is a read-only collision input.
export class ClothPhysics {
  constructor(positions, normals, { collider = null, gap = .014 } = {}) {
    if (positions.length !== normals.length || positions.length % 3) throw Error('Invalid clothing attributes');
    this.base = positions.slice();
    this.normals = normals.slice();
    this.collider = collider;
    this.gap = gap;
    this.offset = new Float32Array(positions.length);
    this.velocity = new Float32Array(positions.length);
    this.stretch = new Float32Array(positions.length / 3);
    this.weights = new Float32Array(positions.length / 3);
    this.positions = new Float32Array(positions.length);
    this.rest = new Float32Array(positions.length);
    this.active = false; this.anchor = null; this.max = 0;
    // UV islands duplicate some positions. Use matching normals at those seams
    // so the separate rendering islands do not split apart during deformation.
    const seams = new Map();
    for (let k = 0; k < this.base.length; k += 3) {
      const key = `${this.base[k]},${this.base[k + 1]},${this.base[k + 2]}`;
      const group = seams.get(key) || { members: [], normal: [0, 0, 0] };
      group.members.push(k); for (let c = 0; c < 3; c++) group.normal[c] += this.normals[k + c]; seams.set(key, group);
    }
    for (const group of seams.values()) {
      const length = Math.hypot(...group.normal) || 1;
      for (const k of group.members) for (let c = 0; c < 3; c++) this.normals[k + c] = group.normal[c] / length;
    }
    for (let k = 0; k < positions.length; k += 3) {
      let point = [0, 1, 2].map(c => this.base[k + c] + this.gap * this.normals[k + c]);
      if (collider) for (let iteration = 0; iteration < 12; iteration++) {
        const next = collider.constrain(point, point, gap).point;
        const distance = Math.hypot(...next.map((x, c) => x - point[c])); point = next;
        if (distance < 1e-6) break;
      }
      this.rest.set(point, k);
    }
    this.positions.set(this.rest);
  }

  grab(point) { this.anchor = { x: point.x, y: point.y, z: point.z }; this.active = true; }
  release() { this.active = false; }

  step(dt, pull, elastic = 55) {
    dt = Math.min(.04, Math.max(0, dt));
    const steps = Math.max(1, Math.ceil(dt * 120)), h = dt / steps;
    const stiffness = 70 + elastic * 1.6, damping = 2 * Math.sqrt(stiffness) * .7;
    const spread = .38 + Math.hypot(pull.x, pull.y, pull.z) * .36;
    let maximum = 0;
    for (let k = 0; k < this.base.length; k += 3) {
      let weight = 0;
      if (this.active && this.anchor) {
        const distance = Math.hypot(this.base[k] - this.anchor.x, this.base[k + 1] - this.anchor.y, this.base[k + 2] - this.anchor.z);
        weight = Math.exp(-Math.pow(distance / spread, 1.6) * 2.2);
        if (this.base[k] * this.anchor.x < 0) weight = 0;
        const sourceY = this.base[k + 1] / 6.3 + 1.073938 / 2;
        weight *= Math.max(0, Math.min(1, (.855 - sourceY) / .035, sourceY / .045));
      }
      this.weights[k / 3] = weight;
      if (weight < 1e-5 && Math.hypot(this.offset[k], this.offset[k + 1], this.offset[k + 2], this.velocity[k], this.velocity[k + 1], this.velocity[k + 2]) < 1e-5) {
        for (let c = 0; c < 3; c++) { this.offset[k + c] = 0; this.velocity[k + c] = 0; this.positions[k + c] = this.rest[k + c]; }
        this.stretch[k / 3] = 0; continue;
      }
      const previous = [this.positions[k], this.positions[k + 1], this.positions[k + 2]];
      for (let step = 0; step < steps; step++) {
        for (let c = 0; c < 3; c++) {
          const j = k + c, target = (c === 0 ? pull.x : c === 1 ? pull.y : pull.z) * weight;
          this.velocity[j] += (stiffness * (target - this.offset[j]) - damping * this.velocity[j]) * h;
          this.offset[j] += this.velocity[j] * h;
        }
        const inward = this.offset[k] * this.normals[k] + this.offset[k + 1] * this.normals[k + 1] + this.offset[k + 2] * this.normals[k + 2];
        if (inward < 0) {
          const vn = this.velocity[k] * this.normals[k] + this.velocity[k + 1] * this.normals[k + 1] + this.velocity[k + 2] * this.normals[k + 2];
          for (let c = 0; c < 3; c++) { this.offset[k + c] -= inward * this.normals[k + c]; if (vn < 0) this.velocity[k + c] -= vn * this.normals[k + c]; }
        }
      }
      let candidate = [this.rest[k] + this.offset[k], this.rest[k + 1] + this.offset[k + 1], this.rest[k + 2] + this.offset[k + 2]];
      if (this.collider) {
        const contact = this.collider.constrain(previous, candidate, this.gap);
        candidate = contact.point;
        if (contact.normal) {
          const vn = contact.normal.reduce((s, n, c) => s + n * this.velocity[k + c], 0);
          if (vn < 0) for (let c = 0; c < 3; c++) this.velocity[k + c] -= vn * contact.normal[c];
        }
      }
      for (let c = 0; c < 3; c++) { this.positions[k + c] = candidate[c]; this.offset[k + c] = candidate[c] - this.rest[k + c]; }
      const distance = Math.hypot(this.offset[k], this.offset[k + 1], this.offset[k + 2]);
      this.stretch[k / 3] = distance; maximum = Math.max(maximum, distance);
    }
    this.max = maximum; return maximum;
  }

  reset() {
    this.active = false; this.anchor = null; this.max = 0;
    this.offset.fill(0); this.velocity.fill(0); this.stretch.fill(0); this.weights.fill(0); this.positions.set(this.rest);
  }
}

"use strict";

//import * as settings from 'settings';

class Vector {
  clone() {
    return new Vector(...this.get_basis_());
  }

  operate(operation, n = 1, basis = this.get_base_names_()) {
    if(!Array.isArray(basis)) basis = [basis];
    let vector = this.clone();
    for(let base of basis) {
      vector[base] = operation(vector[base], typeof n === 'number' ? n : n[base]);
    }
    return vector;
  }

  add(n = 1, basis) {
    let operation = (a, b) => {return a + b;};
    return this.operate(operation, n, basis);
  }

  sub(n = 1, basis) {
    let operation = (a, b) => {return a - b;};
    return this.operate(operation, n, basis);
  }

  mul(n = 1, basis) {
    let operation = (a, b) => {return a * b;};
    return this.operate(operation, n, basis);
  }

  div(n = 1, basis) {
    let operation = (a, b) => {return a / b;};
    return this.operate(operation, n, basis);
  }

  mod(n = 1, basis) {
    let operation = (a, b) => {return a % b;};
    return this.operate(operation, n, basis);
  }

  to_array() {
    return this.get_basis_();
  }

  get_basis_() {
    return [];
  }

  get_base_names_() {
    return [];
  }
}

class Vector3D extends Vector {
  constructor(x = 0, y = 0, z = 0) {
    super();
    Object.assign(this, {x, y, z});
  }

  set(x, y, z) {
    this.x = x;
    this.y = y;
    this.z = z;
  }

  clone() {
    return new Vector3D(...this.get_basis_());
  }

  get_basis_() {
    return [this.x, this.y, this.z];
  }

  get_base_names_() {
    return ['x', 'y', 'z'];
  }
}

class Size extends Vector3D {
  clone() {
    return new Size(...this.get_basis_());
  }

  to_three_array() {
    let array = this.get_basis_();
    return [array[2], array[0], array[1]]
  }

  static diff(a, b) {
    let w = Math.abs(Math.abs(a.x - b.x) - 1);
    let h = Math.abs(Math.abs(a.y - b.y) - 1);
    let d = Math.abs(Math.abs(a.z - b.z) - 1);
    return new Size(x, y, z);
  }
}

class Pos extends Vector3D {
  clone() {
    return new Pos(...this.get_basis_());
  }

  to_three_array() {
    let array = this.get_basis_();
    return [array[2], -array[0], array[1]]
  }

  is_less_than(other) {
    if(this.z < other.z) return true;
    if(this.z > other.z) return false;
    if(this.y < other.y) return true;
    if(this.y > other.y) return false;
    if(this.x < other.x) return true;
    return false;
  }

  static compare(a, b) {
    if(a.z < b.z) return -1;
    if(a.z > b.z) return 1;
    if(a.y < b.y) return -1;
    if(a.y > b.y) return 1;
    if(a.x < b.x) return -1;
    if(a.x > b.x) return 1;
    return 0;
  }

  static min(a, b) {
    if(a.is_less_than(b)) return a;
    return b;
  }
}

class Polyhedron {
  constructor(pos, size, color, transparent, opacity) {
    this.pos = pos.clone();
    this.size = size.clone();
    this.set_visual(color, transparent, opacity);
  }

  create_meshes(geometry, color = settings.DEFAULT_COLOR, transparent = settings.DEFAULT_TRANSPARENT, opacity = settings.DEFAULT_OPACITY) {
    if(this.color != undefined) color = this.color;
    if(this.transparent != undefined) transparent = this.transparent;
    if(this.opacity != undefined) opacity = this.opacity;
    let material = new THREE.MeshLambertMaterial({color: color, transparent: transparent, opacity: opacity});
    let mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(...this.pos.mul(settings.SCALE).to_three_array());
    return [mesh];
  }

  get_visual() {
    let visual = [];
    if(this.color != undefined) visual.push(this.color);
    if(this.transparent != undefined) visual.push(this.transparent);
    if(this.opacity != undefined) visual.push(this.opacity);
    return visual;
  }

  set_visual(color, transparent, opacity) {
    if(color != undefined) this.color = color;
    if(transparent != undefined) this.transparent = transparent;
    if(opacity != undefined) this.opacity = opacity;
  }

  clone() {
    return new Polyhedron(this.pos, this.size);
  }
}

class Rectangular extends Polyhedron {
  create_meshes(...visual) {
    let geometry = new THREE.BoxGeometry(...this.size.mul(settings.SCALE).to_three_array());
    return super.create_meshes(geometry, ...visual);
  }

  clone() {
    return new Rectangular(this.pos, this.size);
  }
}

class SquarePyramid extends Polyhedron {
  constructor(pos, bottom_len, height, axis = 'z', reverse = false, ...visual) {
    super(pos, new Size(bottom_len, bottom_len, height), ...visual);
    let r = reverse ? Math.PI : 0;
    if(axis === 'z')      this.rotation = [Math.PI / 4, 0, r - Math.PI / 2];
    else if(axis === 'x') this.rotation = [r + Math.PI, Math.PI / 4, 0];
    else if(axis === 'y') this.rotation = [Math.PI / 2 - r, Math.PI / 4, 0];
    else console.error('bad axis');
  }

  create_meshes(...visual) {
    let geometry = new THREE.ConeGeometry(this.size.x * settings.SCALE / Math.SQRT2, this.size.z * settings.SCALE, 4);
    let meshes = super.create_meshes(geometry, ...visual);
    for(let mesh of meshes) {
      mesh.rotation.set(...this.rotation);
    }
    return meshes;
  }

  clone() {
    return new SquarePyramid(this.pos, this.size);
  }
}

class Defect extends Rectangular {
  clone() {
    return new Defect(this.pos, this.size);
  }
}

class Vertex extends Defect {
  constructor(pos, ...visual) {
    let size = new Size(1, 1, 1);
    super(pos.mul(settings.PITCH), size, ...visual);
  }

  get_next(base, n = 1) {
    let vertex = this.clone();
    vertex.pos[base] += n * settings.PITCH;
    return vertex;
  }

  clone() {
    return new Vertex(this.pos);
  }

  static compare(a, b) {
    return Pos.compare(a.pos, b.pos);
  }

  static min(a, b) {
    if(a.pos.is_less_than(b.pos)) return a;
    return b;
  }

  static max(a, b) {
    if(a.pos.is_less_than(b.pos)) return b;
    return a;
  }
}

class Edge extends Defect {
  constructor(vertex_a, vertex_b, ...visual) {
    // 引数がPosオブジェクトならVertexを生成
    for(let vertex of [vertex_a, vertex_b]) {
      if(!(vertex instanceof Vertex)) vertex = new Vertex(vertex);
    }
    Edge.check_params(vertex_a, vertex_b);
    let vertices = [vertex_a, vertex_b].sort(Vertex.compare);
    vertex_a = vertices[0];
    vertex_b = vertices[1];
    let axis = Edge.get_axis_(vertex_a, vertex_b);
    let pos = Edge.get_pos_(vertex_a, vertex_b, axis);
    let size = Edge.get_size_(vertex_a, vertex_b, axis);
    super(pos, size, ...visual);
    this.axis = axis;
    this.vertices = vertices;
  }

  create_meshes(...visual) {
    let meshes = [];
    meshes.push(...super.create_meshes(...visual));
    return meshes;
  }

  clone() {
    return new Edge(...this.vertices);
  }

  static check_params(vertex_a, vertex_b) {
    let n = 0;
    if(vertex_a.pos.x !== vertex_b.pos.x) ++n;
    if(vertex_a.pos.y !== vertex_b.pos.y) ++n;
    if(vertex_a.pos.z !== vertex_b.pos.z) ++n;
    console.assert(n === 1, "wrong positions of vertices");
    return n === 1;
  }

  static get_axis_(vertex_a, vertex_b) {
    if(vertex_a.pos.x !== vertex_b.pos.x) return 'x';
    if(vertex_a.pos.y !== vertex_b.pos.y) return 'y';
    if(vertex_a.pos.z !== vertex_b.pos.z) return 'z';
    console.assert(false, "wrong positions of vertices");
  }

  static get_pos_(vertex_a, vertex_b, axis) {
    return vertex_a.pos.add(vertex_b.pos, axis).div(2, axis);
  }

  static get_size_(vertex_a, vertex_b, axis) {
    let size = new Size(1, 1, 1);
    size[axis] = vertex_b.pos[axis] - vertex_a.pos[axis] - 1;
    return size;
  }

  static create_edges(cls, vertices, is_loop = false, ...visual) {
    let edges = [];
    for(let i = 0; i < vertices.length - 1; ++i) {
      let edge = new cls(vertices[i], vertices[i + 1], ...visual);
      edges.push(edge);
    }
    if(is_loop) {
      let edge = new cls(vertices[vertices.length - 1], vertices[0], ...visual);
      edges.push(edge);
    }
    return edges;
  }
}

class Block extends Edge {}

class Injector extends Edge {
  create_meshes(...visual) {
    if(settings.MARGIN < 1.5) {
      return this.create_pyramid_meshes_(this.size[this.axis] / 2, ...visual);
    }
    return [
      ...this.create_pyramid_meshes_((this.size[this.axis] - 2) / 2, ...visual),
      ...this.create_rectangular_meshes_(...visual)
    ];
  }

  create_pyramid_meshes_(size, ...visual) {
    let pos_a = this.pos.sub(size / 2, this.axis);
    let pos_b = this.pos.add(size / 2, this.axis);
    let pyramid_a = new SquarePyramid(pos_a, 1, size, this.axis, false, ...this.get_visual());
    let pyramid_b = new SquarePyramid(pos_b, 1, size, this.axis, true, ...this.get_visual());
    return [
      ...pyramid_a.create_meshes(...visual),
      ...pyramid_b.create_meshes(...visual)
    ];
  }

  create_rectangular_meshes_(...visual) {
    let pos_a = this.vertices[0].pos.add(1, this.axis);
    let pos_b = this.vertices[1].pos.sub(1, this.axis);
    let rectangular_a = new Rectangular(pos_a, new Size(1, 1, 1), ...this.get_visual());
    let rectangular_b = new Rectangular(pos_b, new Size(1, 1, 1), ...this.get_visual());
    return [
      ...rectangular_a.create_meshes(...visual),
      ...rectangular_b.create_meshes(...visual)
    ]
  }
}

class Cap extends Injector {
  create_meshes(color = undefined, transparent = true, opacity = undefined) {
    return super.create_meshes(color, transparent, opacity)
  }
}

class LogicalQubit {
  constructor(edges, raw_data, ...visual) {
    Object.assign(this, {edges})
    this.vertices = this.create_vertices_();
    this.raw_data = raw_data;
    this.set_visual(...visual);
  }

  create_meshes(...visual) {
    let meshes = [];
    for(let defects of [this.edges, this.vertices]) {
      for(let defect of defects) {
        meshes.push(...defect.create_meshes(...visual));
      }
    }
    this.meshes = this.set_id_(meshes);
    return this.meshes;
  }

  create_vertices_() {
    let vertices = new Set();
    for(let edge of this.edges) {
      for(let vertex of edge.vertices) {
        vertices.add(vertex);
      }
    }
    return vertices;
  }

  set_visual(...visual) {
    for(let polyhedron of [...this.edges, ...this.vertices]) {
      polyhedron.set_visual(...visual);
    }
  }

  set_id_(meshes) {
    for(let mesh of meshes) {
      mesh.bit_id = this.raw_data.id;
    }
    return meshes;
  }
}

class Rough extends LogicalQubit {
  create_meshes(color = settings.COLOR_SET.ROUGH, transparent = undefined, opacity = undefined) {
    return super.create_meshes(color, transparent, opacity);
  }
}

class Smooth extends LogicalQubit {
  create_meshes(color = settings.COLOR_SET.SMOOTH, transparent = undefined, opacity = undefined) {
    return super.create_meshes(color, transparent, opacity);
  }
}

class Module extends Rectangular {
  constructor(pos, size, raw_data, ...visual) {
    size = size.mul(settings.PITCH).add(1);
    pos = pos.mul(settings.PITCH).add(size.div(2)).sub(0.5);
    super(pos, size, ...visual);
    this.raw_data = raw_data;
  }

  create_meshes(color = settings.COLOR_SET.MODULE, transparent = undefined, opacity = undefined) {
    return this.set_id_(super.create_meshes(color, transparent, opacity));
  }

  set_id_(meshes) {
    for(let mesh of meshes) {
      mesh.module_id = this.raw_data.id;
      mesh.raw_data = this.raw_data;
    }
    return meshes;
  }
};

class Circuit {
  constructor(logical_qubits = [], modules = [], ...visual) {
    Object.assign(this, {logical_qubits, modules});
    this.set_visual(...visual);
  }

  add(logical_qubits = [], modules = [], ...visual) {
    this.logical_qubits.push(...logical_qubits);
    this.modules.push(...modules);
    this.set_visual(...visual);
  }

  create_meshes(...visual) {
    let meshes = [];
    this.logical_qubit_meshes_map = {};
    for(let logical_qubit of this.logical_qubits) {
      let logical_qubit_meshes = logical_qubit.create_meshes(...visual);
      meshes.push(...logical_qubit_meshes);
      let id = logical_qubit.raw_data.id;
      if(!(id in this.logical_qubit_meshes_map)) this.logical_qubit_meshes_map[id] = [];
      this.logical_qubit_meshes_map[id].push(...logical_qubit_meshes);
    }
    for(let module of this.modules) {
      let module_meshes = module.create_meshes(...visual);
      meshes.push(...module_meshes);
    }
    return meshes;
  }

  set_visual(...visual) {
    for(let elements of [...this.logical_qubits, ...this.modules]) {
      elements.set_visual(...visual);
    }
  }
}

class CircuitCreator {
  static create(data, ...args) {
    let logical_qubits = this.create_logical_qubits(data.logical_qubits, ...args);
    let modules = this.create_modules(data.modules, ...args);
    return new Circuit(logical_qubits, modules);
  }

  static add(circuit, data, ...args) {
    let logical_qubits = this.create_logical_qubits(data.logical_qubits, ...args);
    let modules = this.create_modules(data.modules, ...args);
    circuit.add(logical_qubits, modules);
    return circuit;
  }

  static create_logical_qubits(data = [], base_position = [0, 0, 0], rotation = ['x', 'y', 'z']) {
    let logical_qubits = [];
    for(let logical_qubit_data of data) {
      let blocks    = this.create_blocks(logical_qubit_data.blocks, base_position, rotation);
      let injectors = this.create_injectors(logical_qubit_data.injectors, base_position, rotation);
      let caps      = this.create_caps(logical_qubit_data.caps, base_position, rotation);
      let type = logical_qubit_data.type;
      let cls = type === 'rough' ? Rough : Smooth;
      logical_qubits.push(new cls([...blocks, ...injectors, ...caps], logical_qubit_data));
    }
    return logical_qubits;
  }

  static create_modules(data = [], base_position = [0, 0, 0], rotation = ['x', 'y', 'z']) {
    let modules = [];
    for(let module_data of data) {
      let pos = this.collect_pos_(new Pos(...module_data.position), base_position, rotation);
      let size = new Size(...module_data.size);
      let visual = [];
      if(settings.ENABLED_OVERWRITE_COLORS && 'visual' in module_data) {
        visual = this.parse_visual_(module_data.visual);
      }
      modules.push(new Module(pos, size, module_data, ...visual));
    }
    return modules;
  }

  static create_blocks(...args) {
    return this.create_edges_(Block, ...args);
  }

  static create_injectors(...args) {
    return this.create_edges_(Injector, ...args);
  }

  static create_caps(...args) {
    return this.create_edges_(Cap, ...args);
  }

  static create_edges_(cls, data = [], base_position, rotation) {
    let edges = [];
    for(let raw_vertices_data of data) {
      let vertices_data = [];
      if(Array.isArray(raw_vertices_data))     vertices_data = raw_vertices_data;
      else if('vertices' in raw_vertices_data) vertices_data = raw_vertices_data.vertices;
      let vertices = [];
      for(let vertex_data of vertices_data) {
        let pos = this.collect_pos_(new Pos(...vertex_data), base_position, rotation);
        vertices.push(new Vertex(pos));
      }
      //let vertex_a = new Vertex(new Pos(...vertices[0]));
      //let vertex_b = new Vertex(new Pos(...vertices[1]));
      let visual = [];
      if(settings.ENABLED_OVERWRITE_COLORS && 'visual' in raw_vertices_data) {
        visual = this.parse_visual_(raw_vertices_data.visual);
      }
      //edges.push(new cls(vertex_a, vertex_b, ...visual));
      edges.push(...cls.create_edges(cls, vertices, false, ...visual));
    }
    return edges;
  }

  static collect_pos_(pos, base_position, rotation) {
    let collected_pos = new Pos();
    collected_pos.x = pos[rotation[0]] + base_position[0];
    collected_pos.y = pos[rotation[1]] + base_position[1];
    collected_pos.z = pos[rotation[2]] + base_position[2];
    return collected_pos;
  }

  static parse_visual_(data) {
    let visual = [];
    for(let property of ['color', 'transparent', 'opacity']) {
      visual.push(data[property]);
    }
    return visual;
  }
}

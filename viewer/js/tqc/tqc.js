"use strict";

//import * as settings from 'settings';

function is_same(type, obj) {
  var clas = Object.prototype.toString.call(obj).slice(8, -1);
  return obj !== undefined && obj !== null && clas === type;
}

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
  constructor(pos, size) {
    this.pos = pos.clone();
    this.size = size.clone();
  }

  create_meshes(geometry, color = settings.DEFAULT_COLOR, transparent = settings.DEFAULT_TRANSPARENT, opacity = settings.DEFAULT_OPACITY) {
    let material = new THREE.MeshPhongMaterial({color: color, transparent: transparent, opacity: opacity});
    let mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(...this.pos.mul(settings.SCALE).to_array());
    return [mesh];
  }

  clone() {
    return new Polyhedron(this.pos, this.size);
  }
}

class Rectangular extends Polyhedron {
  create_meshes(...visible) {
    let geometry = new THREE.BoxGeometry(...this.size.mul(settings.SCALE).to_array());
    return super.create_meshes(geometry, ...visible);
  }

  clone() {
    return new Rectangular(this.pos, this.size);
  }
}

class SquarePyramid extends Polyhedron {
  constructor(pos, bottom_len, height, axis = 'z', reverse = false) {
    super(pos, new Size(bottom_len, bottom_len, height));
    let r = reverse ? Math.PI : 0;
    if(axis === 'x')      this.rotation = [Math.PI / 4, 0, r - Math.PI / 2];
    else if(axis === 'y') this.rotation = [r, Math.PI / 4, 0];
    else if(axis === 'z') this.rotation = [Math.PI / 2 - r, Math.PI / 4, 0];
    else console.error('bad axis');
  }

  create_meshes(...visible) {
    let geometry = new THREE.ConeGeometry(this.size.x * settings.SCALE / Math.SQRT2, this.size.z * settings.SCALE, 4);
    let meshes = super.create_meshes(geometry, ...visible);
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
  constructor(pos) {
    let size = new Size(1, 1, 1);
    super(pos.mul(settings.PITCH), size);
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
  constructor(vertex_a, vertex_b) {
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
    super(pos, size);
    this.axis = axis;
    this.vertices = vertices;
  }

  decompose_to_minimum_units() {
    let decomposed_edges = [];
    for(let vertex = this.vertices[0]; Vertex.compare(vertex, this.vertices[1]) === -1;) {
      let next_vertex = vertex.get_next(this.axis);
      decomposed_edges.push(new Edge(vertex, next_vertex));
      console.assert(false, vertex.pos, next_vertex.pos);
      vertex = next_vertex;
    }
    return decomposed_edges;
  }

  create_meshes(...visible) {
    let meshes = [];
    meshes.push(...super.create_meshes(...visible));
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

  static create_edges(vertices, is_loop = false) {
    let edges = [];
    for(let i = 0; i < vertices.length - 1; ++i) {
      let edge = new Edge(vertices[i], vertices[i + 1]);
      edges.push(edge);
    }
    if(is_loop) {
      let edge = new Edge(vertices[vertices.length - 1], vertices[0]);
      edges.push(edge);
    }
    return edges;
  }
}

class Block extends Edge {}

class Injector extends Edge {
  create_meshes(...visible) {
    if(settings.MARGIN < 1.5) {
      return this.create_pyramid_meshes_(this.size[this.axis] / 2, ...visible);
    }
    return [
      ...this.create_pyramid_meshes_((this.size[this.axis] - 2) / 2, ...visible),
      ...this.create_rectangular_meshes_(...visible)
    ];
  }

  create_pyramid_meshes_(size, ...visible) {
    let pos_a = this.pos.sub(size / 2, this.axis);
    let pos_b = this.pos.add(size / 2, this.axis);
    let pyramid_a = new SquarePyramid(pos_a, 1, size, this.axis);
    let pyramid_b = new SquarePyramid(pos_b, 1, size, this.axis, true);
    return [
      ...pyramid_a.create_meshes(...visible),
      ...pyramid_b.create_meshes(...visible)
    ];
  }

  create_rectangular_meshes_(...visible) {
    let pos_a = this.vertices[0].pos.add(1, this.axis);
    let pos_b = this.vertices[1].pos.sub(1, this.axis);
    let rectangular_a = new Rectangular(pos_a, new Size(1, 1, 1));
    let rectangular_b = new Rectangular(pos_b, new Size(1, 1, 1));
    return [
      ...rectangular_a.create_meshes(...visible),
      ...rectangular_b.create_meshes(...visible)
    ]
  }
}

class Cap extends Injector {
  create_meshes(color = undefined, transparent = true, opacity = undefined) {
    return super.create_meshes(color, transparent, opacity)
  }
}

class LogicalQubit {
  constructor(edges) {
    Object.assign(this, {edges})
    this.vertices = this.create_vertices_();
  }

  create_meshes(...visible) {
    let meshes = [];
    for(let defects of [this.edges, this.vertices]) {
      for(let defect of defects) {
        meshes.push(...defect.create_meshes(...visible));
      }
    }
    return meshes;
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
  apply(scene) {
    var mesh = this.createMesh();
    scene.add(mesh);
    if(dispEdges) {
      var edge = new THREE.EdgesHelper(mesh, 0x000000);
      scene.add(edge);
    }
  }

  create_meshes(color = settings.COLOR_SET.MODULE, transparent = undefined, opacity = undefined) {
    super.create_meshes(color, transparent, opacity);
  }
};

class Circuit {
  constructor(logical_qubits, modules) {
    Object.assign(this, {logical_qubits, modules});
  }

  create_meshes(...visible) {
    let meshes = [];
    for(let polyhedrons of [this.logical_qubits, this.modules]) {
      for(let polyhedron of polyhedrons) {
        meshes.push(...polyhedron.create_meshes(...visible));
      }
    }
    return meshes;
  }
}

class CircuitCreator {
  static create(data) {
    let logical_qubits = this.create_logical_qubits(data.logical_qubits);
    let modules = this.create_modules(data.modules);
    return new Circuit(logical_qubits, modules);
  }

  static create_logical_qubits(data = []) {
    let logical_qubits = [];
    for(let logical_qubit_data of data) {
      let blocks    = this.create_blocks(logical_qubit_data.blocks);
      let injectors = this.create_injectors(logical_qubit_data.injectors);
      let caps      = this.create_caps(logical_qubit_data.caps);
      let type = logical_qubit_data.type;
      let cls = type === 'rough' ? Rough : Smooth;
      logical_qubits.push(new cls([...blocks, ...injectors, ...caps]));
    }
    return logical_qubits;
  }

  static create_modules(data = []) {
    let modules = [];
    for(let module_data of data) {
      let pos = new Pos(...module_data.position);
      let size = new Size(...module_data.size);
      edges.push(new Module(pos, size));
    }
    return modules;
  }

  static create_blocks(data) {
    return this.create_edges_(data, Block);
  }

  static create_injectors(data) {
    return this.create_edges_(data, Injector);
  }

  static create_caps(data) {
    return this.create_edges_(data, Cap);
  }

  static create_edges_(data = [], cls) {
    let edges = [];
    for(let vertices of data) {
      let vertex_a = new Vertex(new Pos(...vertices[0]));
      let vertex_b = new Vertex(new Pos(...vertices[1]));
      edges.push(new cls(vertex_a, vertex_b));
    }
    return edges;
  }
}

class CircuitDrawer {
  static draw(circuit, scene) {
    for(let mesh of circuit.create_meshes()) {
      scene.add(mesh);
      if(settings.DISPLAY_EDGES_FLAG) {
        let edge = new THREE.EdgesHelper(mesh, 0x000000, 0.01);
        scene.add(edge);
      }
    }
  }
}
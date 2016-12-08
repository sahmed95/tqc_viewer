"use strict";

import * as settings from 'settings';

var dispEdges = true;


function is_same(type, obj) {
  var clas = Object.prototype.toString.call(obj).slice(8, -1);
  return obj !== undefined && obj !== null && clas === type;
}

class Vector {
  clone() {
    return new Vector(...this.get_basis_());
  }

  operate(opration, n = 1, basis = this.get_base_names_()) {
    if(!Array.isArray(basis)) basis = [basis];
    let vector = this.clone();
    for(let base of basis) {
      if(typeof n === 'number') operation(vector[base], n);
      else                      operation(vector[base], n[base]);
    }
    return base;
  }

  add(n = 1, basis) {
    let operation = (a, b) => {a += b;};
    return this.operate(operation, n, basis);
  }

  sub(n = 1, basis) {
    let operation = (a, b) => {a -= b;};
    return this.operate(operation, n, basis);
  }

  mul(n = 1, basis) {
    let operation = (a, b) => {a *= b;};
    return this.operate(operation, n, basis);
  }

  div(n = 1, basis) {
    let operation = (a, b) => {a /= b;};
    return this.operate(operation, n, basis);
  }

  mod(n = 1, basis) {
    let operation = (a, b) => {a %= b;};
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

  static min(a, b) {
    if(a.is_less_than(b)) return a;
    return b;
  }
}

class Polyhedron {
  constructor(pos, size) {
    Object.assign(this, {pos, size});
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
  constructor(...args) {
    super(...args);
  }

  create_meshes(color = settings.DEFAULT_COLOR, transparent = settings.DEFAULT_TRANSPARENT, opacity = settings.DEFAULT_OPACITY) {
    let geometry = new THREE.BoxGeometry(...this.size.mul(settings.SCALE).to_array());
    return super.create_meshes(geometry, color, transparent, opacity);
  }
}

class SquarePyramid extends Polyhedron {
  constructor(pos, bottom_len, height, axis = 'z', reverse = false) {
    super(pos, new Size(bottom_len, bottom_len, height));
    let r = reverse ? Math.PI : 0;
    if(axis === 'x')      this.rotation = {0, r - Math.PI / 2, 0};
    else if(axis === 'y') this.rotation = {r - Math.PI / 2, 0, 0};
    else if(axis === 'z') this.rotation = {r, 0, 0};
  }

  create_meshes(color = settings.DEFAULT_COLOR, transparent = settings.DEFAULT_TRANSPARENT, opacity = settings.DEFAULT_OPACITY) {
    var geometry = new THREE.ConeGeometry(this.size.x * settings.SCALE / Math.SQRT2, this.size.z * settings.SCALE, 4);
    var mesh = super.create_meshes(geometry, color, transparent, opacity);
    mesh.rotation.set(...rotation);
    return mesh;
  }
}

class Defect extends Rectangular {}

class Vertex extends Defect {
  constructor(pos) {
    let size = new Size(1, 1, 1);
    super(pos, size);
  }

  get_next(base, n = 1) {
    let vertex = this.clone();
    vertex.pos[base] += n * settings.PITCH;
    return vertex;
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
    let axis = this.get_axis_(vertex_a, vertex_b);
    let pos  = this.get_size_(vertex_a, vertex_b, axis);
    let size = this.get_size_(vertex_a, vertex_b, axis);
    super(pos, size);
    this.axis = axis;
    this.vertices = [vertex_a, vertex_b];
  }

  decompose_to_minimum_units() {
    let decomposed_edges = [];
    let axis = this.get_axis();
    let begin = Vertex.min(...this.vertices);
    let end   = Vertex.max(...this.vertices);
    for(let vertex = begin.clone(); vertex !== end;) {
      let next_vertex = vertex.get_next(axis);
      decomposed_edges.push(new Edge(vertex, next_vertex));
      vertex = next_vertex;
    }
    return decomposed_edges;
  }

  create_meshes(color = settings.DEFAULT_COLOR, transparent = settings.DEFAULT_TRANSPARENT, opacity = settings.DEFAULT_OPACITY) {
    let meshes = [];
    for(let decomposed_edge : this.decompose_to_minimum_units()) {
      meshes.push(...decomposed_edge.super.create_meshes(color, transparent, opacity));
    }
    return meshes;
  }

  get_axis_(vertex_a, vertex_b) {
    if(vertex_a.x !== vertex_b.x) return 'x';
    if(vertex_a.y !== vertex_b.y) return 'y';
    if(vertex_a.z !== vertex_b.z) return 'z';
  }

  get_pos_(vertex_a, vertex_b, axis) {
    return Pos.min(vertex_a.pos, vertex_b.pos).add(1, axis);
  }

  get_size_(vertex_a, vertex_b, axis) {
    let size = new Size(1, 1, 1);
    size[axis] = Math.abs(vertex_a[axis] - vertex_b[axis]) - 1;
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

class Injector {
  create_meshes(color = settings.DEFAULT_COLOR, transparent = settings.DEFAULT_TRANSPARENT, opacity = settings.DEFAULT_OPACITY) {
    let height = this.size[this.axis] / 2;
    let opposite_pos = this.pos.add(this.size[axis], this.axis);
    let pyramid_a = new SquarePyramid(this.pos, 1, height, axis);
    let pyramid_b = new SquarePyramid(opposite_pos, 1, height, axis, true);
    return [...pyramid_a.create_meshes(color, transparent, opacity),
            ...pyramid_b.create_meshes(color, transparent, opacity)];
  }
}

class Cap extends Injector {
  create_meshes(color = settings.DEFAULT_COLOR, transparent = true, opacity = settings.DEFAULT_OPACITY) {
    return super.create_meshes(color, transparent, opacity)
  }
}

class LogicalQubit {
  constructor(edges) {
    Object.assign(this, {edges})
    this.vertices = this.create_vertices_();
  }

  create_meshes(color = settings.DEFAULT_COLOR, transparent = settings.DEFAULT_TRANSPARENT, opacity = settings.DEFAULT_OPACITY) {
    let meshes = [];
    for(let defects of [this.edges, this.vertices]) {
      for(let defect of defects) {
        meshes.push(...defect.create_meshes(color, transparent, opacity));
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
  create_meshes(color = settings.COLOR_SET.ROUGH, transparent = settings.DEFAULT_TRANSPARENT, opacity = settings.DEFAULT_OPACITY) {
    return super.create_meshes(color, transparent, opacity);
  }
}

class Smooth extends LogicalQubit {
  create_meshes(color = settings.COLOR_SET.SMOOTH, transparent = settings.DEFAULT_TRANSPARENT, opacity = settings.DEFAULT_OPACITY) {
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

  create_meshes(color = settings.COLOR_SET.MODULE, transparent = settings.DEFAULT_TRANSPARENT, opacity = settings.DEFAULT_OPACITY) {
    super.create_meshes(color, transparent, opacity);
  }
};

class Circuit {
  constructor(logical_qubits, modules) {
    Object.assign(this, {logical_qubits, modules});
  }

  create_meshes(color = settings.DEFAULT_COLOR, transparent = settings.DEFAULT_TRANSPARENT, opacity = settings.DEFAULT_OPACITY) {
    let meshes = [];
    for(let polyhedrons of [this.logical_qubits, this.modules]) {
      for(let polyhedron of polyhedrons) {
        meshes.push(...polyhedron.create_meshes(color, transparent, opacity));
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

  static create_logical_qubits(data) {
    return [
      this.create_blocks(data.blocks),
      this.create_injectors(data.injectors),
      this.create_caps(data.caps)
    ];
  }

  static create_modules(data) {
    let modules = [];
    for(let module_data of data) {
      let pos = new Pos(...module_data.position);
      let size = new Size(...module_data.size);
      edges.push(new Module(pos, size));
    }
    return edges;
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

  static create_edges_(data, cls) {
    let edges = [];
    for(let vertices of data) {
      let vartex_a = new Vertex(new Pos(...vertices[0]));
      let vartex_b = new Vertex(new Pos(...vertices[1]));
      edges.push(new cls(vertex_a, vertex_b));
    }
    return edges;
  }
}

class CircuitDrawer {
  static draw(circuit, scene) {
    for(let mesh of circuit.create_meshes()) {
      scene.add(mesh);
      if(settings.FLAGS.DISPLAY_EDGES) {
        let edge = new THREE.EdgesHelper(mesh, 0x000000);
        scene.add(edge);
      }
    }
  }
}

var main = function(data) {
  var scene = new THREE.Scene();

  var width  = window.innerWidth;
  var height = window.innerHeight;
  var fov    = 60;
  var aspect = width / height;
  var near   = 1;
  var far    = 1000;
  var camera = new THREE.PerspectiveCamera(fov, aspect, near, far);
  camera.position.set(0, -40, 35);

  var renderer = new THREE.WebGLRenderer();
  renderer.setSize(width, height);
  renderer.setClearColor(new THREE.Color(0xffffff));
  document.getElementById('canvas').appendChild(renderer.domElement);

  var directionalLight = new THREE.DirectionalLight(0xffffff, settings.DIRECTIONAL_LIGHT_LEVEL);
  var ambientLight = new THREE.AmbientLight(0xffffff, settings.AMBIENT_LIGHT_LEVEL);
  directionalLight.position.set(0, -0.5, 0.7);
  scene.add(directionalLight);
  scene.add(ambientLight);

  var circuit = CircuitCreator.create(data);

  CircuitDrawer.draw(circuit, scene);

  var controls = new THREE.OrbitControls(camera);

  (function renderLoop() {
    requestAnimationFrame(renderLoop);
    controls.update();
    renderer.render(scene, camera);
  })();
};

//window.addEventListener('DOMContentLoaded', main, false);

function handleFileSelect() {
  var file = document.getElementById('file').files[0];
  var reader = new FileReader();

  reader.onload = function(evt) {
    document.getElementById('input').style.display = 'none';
    let json = evt.target.result;
    let data = JSON.parse(json);
    main(data);
  };

  reader.readAsText(file, 'utf-8');
}

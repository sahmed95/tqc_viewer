"use strict";

import * as settings from 'settings';

var dispEdges = true;
var directionalLightLevel = 0.7;
var ambientLightLevel = 0.4;

function isSame(type, obj) {
  var clas = Object.prototype.toString.call(obj).slice(8, -1);
  return obj !== undefined && obj !== null && clas === type;
}

class Size {
  constructor(w, h, d) {
    this.w = w;
    this.h = h;
    this.d = d;
  }

  set(w, h, d) {
    this.w = w;
    this.h = h;
    this.d = d;
  }

  clone() {
    return new Size(this.w, this.h, this.d);
  }

  to_array() {
    return [this.w, this.h, this.d];
  }

  static diff(a, b) {
    let w = Math.abs(Math.abs(a.w - b.w) - 1);
    let h = Math.abs(Math.abs(a.h - b.h) - 1);
    let d = Math.abs(Math.abs(a.d - b.d) - 1);
    return new Size(w, h, d);
  }
}

class Pos {
  constructor(x, y, z) {
    this.x = x;
    this.y = y;
    this.z = z;
  }

  set(x, y, z) {
    this.x = x;
    this.y = y;
    this.z = z;
  }

  clone() {
    return new Pos(this.x, this.y, this.z);
  }

  add(axis, n = 1) {
    let pos = this.clone();
    pos[axis] += n * settings.PITCH;
    return pos;
  }

  add_x(n = 1) {
    return this.add('x', n);
  }

  add_y(n = 1) {
    return this.add('y', n);
  }

  add_z(n = 1) {
    return this.add('z', n);
  }

  sub(axis, n = 1) {
    let pos = this.clone();
    pos[axis] -= n * settings.PITCH;
    return pos;
  }

  sub_x(n = 1) {
    return this.sub('x', n);
  }

  sub_y(n = 1) {
    return this.sub('y', n);
  }

  sub_z(n = 1) {
    return this.sub('z', n);
  }

  increase(axis, n = 1) {
    this[axis] += n * settings.PITCH;
    return this;
  }

  increase_x(n = 1) {
    return this.increase('x', n);
  }

  increase_y(n = 1) {
    return this.increase('y', n);
  }

  increase_z(n = 1) {
    return this.increase('z', n);
  }

  decrease(axis) {
    this[axis] -= n * settings.PITCH;
    return this;
  }

  decrease_x(n = 1) {
    return this.decrease('x', n);
  }

  decrease_y(n = 1) {
    return this.decrease('y', n);
  }

  decrease_z(n = 1) {
    return this.decrease('z', n);
  }

  to_array() {
    return [this.x, this.y, this.z];
  }

  static axes() {
    return ['x', 'y', 'z'];
  }

  static min(a, b) {
    if(a.z < b.z) return a;
    if(a.z > b.z) return b;
    if(a.y < b.y) return a;
    if(a.y > b.y) return b;
    if(a.x < b.x) return a;
    return b;
  }
}

class Defect {
  constructor(pos, size, color, transparent, opacity) {
    Object.assign(this, {pos, size});
    if(color) this.color = color;
    if(transparent) this.transparent = transparent;
    if(opacity) this.opacity = opacity;
  }

  create_meshes(color = this.color, transparent = this.transparent, opacity = this.opacity) {
    if(!color) color = settings.DEFAULT_COLOR;
    if(!transparent) transparent = settings.DEFAULT_TRANSPARENT;
    if(!opacity) opacity = settings.DEFAULT_OPACITY;
    let geometry = new THREE.BoxGeometry(this.size.w * settings.SCALE, this.size.h * settings.SCALE, this.size.d * settings.SCALE);
    let material = new THREE.MeshPhongMaterial({color: color, transparent: transparent, opacity: opacity});
    let mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(this.pos.x * settings.SCALE, this.pos.y * settings.SCALE, this.pos.z * settings.SCALE);
    return [mesh];
  }
}

class Vertex extends Defect {
  constructor(pos, color, transparent, opacity) {
    let size = new Size(1, 1, 1);
    super(pos, size, color, transparent, opacity);
  }
}

class Edge extends Defect {
  constructor(vertex_a, vertex_b, color, transparent, opacity) {
    for(let vertex of [vertex_a, vertex_b]) {
      if(!(vertex instanceof Vertex)) vertex = new Vertex(vertex);
    }
    let pos = Pos.min(vertex_a.pos, vertex_b.pos);
    let size = Size.diff(vertex_a.size, vertex_b.size);
    super(pos, size, color, transparent, opacity);
    this.vertices = [vertex_a, vertex_b];
  }

  get_axis() {
    if(size.w)      return 'x';
    else if(size.h) return 'y';
    else if(size.d) return 'z';
  }

  decompose() {
    let decomposed_edges = [];
    let axis = this.get_axis();
    let pos = this.pos.clone();
    while(pos !== this.vertices[]) {
      let next_pos = pos.add(axis);
      decomposed_edges.push(new Edge(pos, next_pos));
      pos.increase(axis);
    }
    return decomposed_edges;
  }

  create_meshes(color = settings.DEFAULT_COLOR, transparent = settings.DEFAULT_TRANSPARENT, opacity = settings.DEFAULT_OPACITY) {
    let meshes = [];
    for(let decomposed_edge : this.decompose()) {
      meshes.push(decomposed_edge.super.create_meshes(color, transparent, opacity));
    }
    return meshes;
  }

  static create_edges(vertices, is_loop = false) {
    let edges = [];
    for(let i = 0; i < vertices.length - 1; i++) {
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

class Block extends Edge {
  constructor(...args) {
    super(...args);
  }
}

class Injector {
  constructor(...args) {
    super(...args);
  }

  constructor(col, row) {
    var x = pitch * col;
    var y = -pitch * row;
    var [zj1, zj2] = [0, pitch];
    var [zc1, zc2] = [pitch / 2 - 0.5, pitch / 2 + 0.5];
    var [zb1, zb2] = [(zc1 + zj1) / 2, (zj2 + zc2) / 2];
    this.cone1 = new Block(new Pos(x, y, zc1), new Size(1, 1, 1));
    this.cone2 = new Block(new Pos(x, y, zc2), new Size(1, 1, 1));
    this.block1 = new Block(new Pos(x, y, zb1), new Size(1, 1, zc1 - zj1 - 1));
    this.block2 = new Block(new Pos(x, y, zb2), new Size(1, 1, zj2 - zc2 - 1));
    this.color = colors.rough;
    this.ghost = false;
  }

  apply(scene) {
    for(let meshes of [this.createConeMeshes_(), this.createBlockMeshes_()]) {
      for(let mesh of meshes) {
        scene.add(mesh);
        if(dispEdges) {
          let edge = new THREE.EdgesHelper(mesh, 0x000000);
          scene.add(edge);
        }
      }
    }
  }

  createConeMeshes_() {
    var mesh1 = this.createConeMesh_(this.cone1, [Math.PI / 2, Math.PI / 4, 0]);
    var mesh2 = this.createConeMesh_(this.cone2, [-Math.PI / 2, Math.PI / 4, 0]);
    return [mesh1, mesh2];
  }

  createBlockMeshes_() {
    var mesh1 = this.createBlockMesh_(this.block1);
    var mesh2 = this.createBlockMesh_(this.block2);
    return [mesh1, mesh2];
  }

  createConeMesh_(cone, rotation) {
    var geometry = new THREE.ConeGeometry(cone.size.w * scale / Math.SQRT2, cone.size.w * scale, 4);
    var material = new THREE.MeshPhongMaterial({color: this.color, opacity: opacity, transparent: this.ghost});
    var mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(cone.pos.x * scale, cone.pos.y * scale, cone.pos.z * scale);
    mesh.rotation.set(...rotation);
    return mesh;
  }

  createBlockMesh_(block) {
    var geometry = new THREE.BoxGeometry(block.size.w * scale, block.size.h * scale, block.size.d * scale);
    var material = new THREE.MeshPhongMaterial({color: this.color, opacity: opacity, transparent: this.ghost});
    var mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(block.pos.x * scale, block.pos.y * scale, block.pos.z * scale);
    return mesh;
  }
}

class Cap extends Injector {
  constructor(...args) {
    super(...args);
    this.transparent = true;
  }
}

class LogicalQubit {
  constructor(edges, color = settings.DEFAULT_COLOR, transparent = settings.DEFAULT_TRANSPARENT, opacity = settings.DEFAULT_OPACITY) {
    Object.assign(this, {edges, color, transparent, opacity})
    this.vertices = this.create_vertices_();
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

  create_meshes() {
    let meshes = [];
    for(let defects of [this.edges, this.vertices]) {
      for(let defect of defects) {
        Array.prototype.push.apply(meshes, defect.create_meshes(this.color, this.transparent, this.opacity));
      }
    }
    return meshes;
  }
}

class Rough extends LogicalQubit {
  constructor(edges, transparent = settings.DEFAULT_TRANSPARENT, opacity = settings.DEFAULT_OPACITY) {
    super(edges, settngs.COLOR_SET.rough, transparent, opacity);
  }
}

class Smooth extends LogicalQubit {
  constructor(edges, transparent = settings.DEFAULT_TRANSPARENT, opacity = settings.DEFAULT_OPACITY) {
    super(edges, settngs.COLOR_SET.smooth, transparent, opacity);
  }
}

class Connection extends Rough {
  constructor(sourceJoint, destJoint, routeJoints) {
    var joints = [];
    var prevJoint = sourceJoint;
    for(let routeJoint of routeJoints) {
      let halfwayJoints = Connection.createHalfwayJoints(prevJoint, routeJoint);
      joints.push(...halfwayJoints);
      joints.push(routeJoint);
      prevJoint = routeJoint;
    }
    var halfwayJoints = Connection.createHalfwayJoints(prevJoint, destJoint);
    joints.push(...halfwayJoints);
    var edges = Edge.createEdges([sourceJoint, ...joints, destJoint]);
    super(joints, edges);
  }

  static createHalfwayJoints(joint1, joint2) {
    var joints = [];
    var [pos1, pos2] = [joint1.pos, joint2.pos];
    var axis = Connection.getDiffAxis(pos1, pos2);
    var direct = (pos1[axis] - pos2[axis] < 0);
    var pos = new Pos(pos1.x, pos1.y, pos1.z);
    direct ? pos.inc(axis) : pos.dec(axis);
    while(pos[axis] != pos2[axis]) {
      joints.push(new Joint(pos));
      direct ? pos.inc(axis) : pos.dec(axis);
    }
    return joints;
  }

  static getDiffAxis(pos1, pos2) {
    for(let axis of Pos.axes()) {
      let dist = pos1[axis] - pos2[axis];
      if(dist != 0) {
        return axis;
      }
    }
    return null;
  }
}

class Bridge extends Rough {
  constructor(col, row) {
    var x = pitch * col;
    var y = -pitch * row;
    var z = function(i) {return pitch * i;};
    var joint1 = new Joint(new Pos(x, y, z(0)));
    var joint2 = new Joint(new Pos(x, y, z(1)));
    var edges = Edge.createEdges([joint1, joint2]);
    super([], edges);
  }
}

class Switch extends Bridge {
  constructor(...args) {
    super(...args);
    this.ghost = true;
  }
}

class SingleBitLine extends Rough {
  constructor(no, range, pairType) {
    var x = function(i) {return pitch * i;};
    var y = -pitch * no;
    var z = pairType == 'j' ? pitch : 0;
    var joints = [];
    for(let i = range[0]; i <= range[1]; i++) {
      let joint = new Joint(new Pos(x(i), y, z));
      joints.push(joint);
    }
    var edges = Edge.createEdges(joints);
    super(joints, edges);
  }
}

class BitLine {
  constructor(no, range, bridges = [], switches = [], injectors = []) {
    this.no = no;
    this.range = range;
    this.lines = [new SingleBitLine(no, range, 'j'),
                  new SingleBitLine(no, range, 'k')];
    this.bridges = bridges;
    this.switches = switches;
    this.injectors = injectors;
  }

  addBridge(col) {
    var bridge = new Bridge(col, this.no);
    this.bridges.push(bridge);
  }

  apply(scene) {
    for(let elements of [this.lines, this.bridges, this.switches, this.injectors]) {
      for(let element of elements) {
        element.apply(scene);
      }
    }
  }
}

class Braiding extends Smooth {
  constructor(cbitNo, tbitNoArray, col) {
    var bitNoArray = tbitNoArray.concat([cbitNo]);
    var minBitNo = Math.min.apply(null, bitNoArray);
    var maxBitNo = Math.max.apply(null, bitNoArray);
    var pos = new Pos(pitch * col - pitch / 2,
                      -pitch * minBitNo + pitch / 2,
                      pitch / 2);
    var upper = (minBitNo != cbitNo);
    if(upper) {
      pos.incz();
    }
    var joints = [new Joint(pos)];
    var push = function() {
      joints.push(new Joint(pos));
    };
    for(let bitNo = minBitNo; bitNo <= maxBitNo; bitNo++) {
      if(bitNo == cbitNo || tbitNoArray.indexOf(bitNo) != -1) {
        if(upper) {
          pos.decz();
          upper = false;
          push();
        }
      }
      else {
        if(!upper) {
          pos.incz();
          upper = true;
          push();
        }
      }
      pos.decy();
      push();
    }
    if(!upper && maxBitNo != cbitNo) {
      pos.incz();
      upper = true;
      push();
    }
    pos.incx();
    push();
    for(let bitNo = maxBitNo; bitNo >= minBitNo; bitNo--) {
      if(bitNo == cbitNo) {
        if(upper) {
          pos.decz();
          upper = false;
          push();
        }
      }
      else {
        if(!upper) {
          pos.incz();
          upper = true;
          push();
        }
      }
      pos.incy();
      push();
    }
    pos.decx();
    push();

    var edges = Edge.createEdges(joints, false);
    super(joints, edges);
    this.col = col;
  }
}

class Module {
  constructor(pos, size) {
    this.pos = new Pos(pos.x, pos.y, pos.z);
    this.size = new Size(size.w, size.h, size.d);
    this.ghost = false;
  }

  apply(scene) {
    var mesh = this.createMesh();
    scene.add(mesh);
    if(dispEdges) {
      var edge = new THREE.EdgesHelper(mesh, 0x000000);
      scene.add(edge);
    }
  }

  createMesh() {
    var geometry = new THREE.BoxGeometry(this.size.w * scale, this.size.h * scale, this.size.d * scale);
    var material = new THREE.MeshPhongMaterial({color: colors.module, opacity: opacity, transparent: this.ghost});
    var mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(this.pos.x * scale, this.pos.y * scale, this.pos.z * scale);
    return mesh;
  }
};

class Circuit {
  constructor(length) {
    this.length = length;
    this.bits = [];
    this.braidings = [];
    this.modules = [];
    this.connections = [];
  }

  getBit(bitNo) {
    for(let bit of this.bits) {
      if(bit.no == bitNo) {
        return bit;
      }
    }
    return null;
  }

  addBit() {
    var no = this.bits.length;
    var range = [0, this.length];
    this.insertBit(no, range);
  }

  insertBit(...args) {
    var bit = new BitLine(...args);
    this.bits.push(bit);
  }

  addBraiding(cbitNo, tbitNoArray) {
    var col = this.braidings.length * 2 + 1;
    this.insertBraiding(cbitNo, tbitNoArray, col);
  }

  insertBraiding(cbitNo, tbitNoArray, col) {
    var braiding = new Braiding(cbitNo, tbitNoArray, col);
    this.braidings.push(braiding);
    var cbit = this.getBit(cbitNo);
    cbit.addBridge(col);
  }

  insertModule(pos, size, ghost = false) {
    var module = new Module(pos, size);
    module.ghost = ghost;
    this.modules.push(module);
  }

  insertConnection(sourcePos, destPos, routePosArray, ghost = false) {
    var sourceJoint = new Joint(sourcePos);
    var destJoint = new Joint(destPos);
    var routeJoints = routePosArray.map(function(e) {return new Joint(e)});
    var conn = new Connection(sourceJoint, destJoint, routeJoints);
    conn.ghost = ghost;
    this.connections.push(conn);
  }

  apply(scene) {
    for(let elements of [this.bits, this.braidings, this.modules, this.connections]) {
      for(let element of elements) {
        element.apply(scene);
      }
    }
  }
}

class CircuitCreator {
  constructor(data) {
    this.data = data;
  }

  create() {
    var colRange = this.data.bits ? this.getColRange() : [0, 0];
    this.circuit = new Circuit(colRange[1]);
    this.addBits();
    this.addBraidings();
    this.addModules();
    this.addConnections();
    return this.circuit;
  }

  addBits() {
    if(!this.data.bits) {
      return;
    }
    for(let bit of this.data.bits) {
      let bridges = CircuitCreator.createBlocks(bit.bridges, bit.row, Bridge);
      let switches = CircuitCreator.createBlocks(bit.switches, bit.row, Switch);
      let injectors = CircuitCreator.createBlocks(bit.injectors, bit.row, Injector);
      let caps = CircuitCreator.createBlocks(bit.caps, bit.row, Cap);
      let pins = CircuitCreator.createBlocks(bit.pins, bit.row, Pin);
      injectors.push(...caps, ...pins);

      this.circuit.insertBit(bit.row, bit.range, bridges, switches, injectors);
    }
  }

  addBraidings() {
    if(!this.data.braidings) {
      return;
    }
    for(let braiding of this.data.braidings) {
      let cbitNo = braiding.control;
      let tbitNoArray = braiding.targets;
      let col = braiding.column;
      this.circuit.insertBraiding(cbitNo, tbitNoArray, col);
    }
  }

  addModules() {
    if(!this.data.modules) {
      return;
    }
    for(let module of this.data.modules) {
      var rowToY = function(a) {return [a[0], a[1] * -1, a[2]]};
      var scaling = function(e) {return e * pitch + 1};
      let size = new Size(...module.size.map(scaling));
      let rawPos = rowToY(module.position).map(scaling);
      rawPos[0] += size.w / 2 - 1.5
      rawPos[1] -= size.h / 2 + 0.5;
      rawPos[2] += size.d / 2 - 1.5;
      let pos = new Pos(...rawPos);
      let ghost = module.ghost ? module.ghost : false;
      this.circuit.insertModule(pos, size, ghost);
    }
  }

  addConnections() {
    if(!this.data.connections) {
      return;
    }
    for(let conn of this.data.connections) {
      var rowToY = function(a) {return [a[0], a[1] * -1, a[2]]};
      var scaling = function(e) {return e * pitch};
      let sourcePos = new Pos(...rowToY(conn.source).map(scaling));
      let destPos = new Pos(...rowToY(conn.destination).map(scaling));
      let routePosArray = conn.route ? conn.route.map(function(e) {return (new Pos(...rowToY(e).map(scaling)))}) : [];
      let ghost = conn.ghost ? conn.ghost : false;
      this.circuit.insertConnection(sourcePos, destPos, routePosArray, ghost);
    }
  }

  getColRange() {
    var min = 0;
    var max = 0;
    for(let bit of this.data.bits) {
      min = Math.min(min, bit.range[0]);
      max = Math.max(max, bit.range[1]);
    }
    return [min, max];
  }

  static createBlock(json, row, AbstructBlock) {
    if(isSame('Number', json)) {
      return new AbstructBlock(json, row);
    }
    var col = json.column;
    var block = new AbstructBlock(col, row);
    if(json.color) {
      block.color = parseInt(json.color, 16);
    }
    return block;
  }

  static createBlocks(jsonArray, row, AbstructBlock) {
    if(!jsonArray) {
      return [];
    }
    return jsonArray.map(function(e) {return CircuitCreator.createBlock(e, row, AbstructBlock)});
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

  var directionalLight = new THREE.DirectionalLight(0xffffff, directionalLightLevel);
  var ambientLight = new THREE.AmbientLight(0xffffff, ambientLightLevel);
  directionalLight.position.set(0, -0.5, 0.7);
  scene.add(directionalLight);
  scene.add(ambientLight);

  var circuit = new CircuitCreator(data).create();

  //var circuit = new Circuit(10);
  //circuit.addBit();
  //circuit.addBit();
  //circuit.addBit();
  //circuit.addBraiding(1, [0, 2]);
  //circuit.addBraiding(0, [2]);
  //circuit.insertModule(new Pos(5, -5, pitch + 5), new Size(10, 10, 10));

  circuit.apply(scene);

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

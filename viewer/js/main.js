"use strict";

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

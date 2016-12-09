"use strict";

var main = function(data) {
  let scene = new THREE.Scene();

  let width  = window.innerWidth;
  let height = window.innerHeight;
  let fov    = 60;
  let aspect = width / height;
  let near   = 1;
  let far    = 1000;
  let camera = new THREE.PerspectiveCamera(fov, aspect, near, far);
  camera.position.set(0, -40, 35);

  let renderer = new THREE.WebGLRenderer();
  renderer.setSize(width, height);
  renderer.setClearColor(new THREE.Color(0xffffff));
  document.getElementById('canvas').appendChild(renderer.domElement);

  let directionalLight = new THREE.DirectionalLight(0xffffff, settings.DIRECTIONAL_LIGHT_LEVEL);
  let ambientLight = new THREE.AmbientLight(0xffffff, settings.AMBIENT_LIGHT_LEVEL);
  directionalLight.position.set(0, -0.5, 0.7);
  scene.add(directionalLight);
  scene.add(ambientLight);

  let circuit = CircuitCreator.create(data);

  CircuitDrawer.draw(circuit, scene);

  let controls = new THREE.OrbitControls(camera);

  (function renderLoop() {
    requestAnimationFrame(renderLoop);
    controls.update();
    renderer.render(scene, camera);
  })();
};

$(function() {
  let dropZone = $('#drop-zone');
  let fileSelector = $('#file-selector');

  // イベントをキャンセル
  let cancelEvent = function(event) {
    event.preventDefault();
    event.stopPropagation();
    return false;
  }

  // dragenter, dragover イベントのデフォルト処理をキャンセル
  dropZone.on('dragenter', cancelEvent);
  dropZone.on('dragover', cancelEvent);

  // イベントをファイル選択ダイアログの表示に変更
  let openFileSelectionDialog = function(event) {
    fileSelector.click();
    return cancelEvent(event);
  }

  // click イベントをファイル選択ダイアログの表示に変更
  dropZone.on('click', openFileSelectionDialog);

  let readFile = function(file) {
    // ファイルの内容は FileReader で読み込む
    let fileReader = new FileReader();
    fileReader.onload = function(event) {
      // event.target.result に読み込んだファイルの内容が入る
      dropZone.hide();
      fileSelector.hide();
      let json = event.target.result;
      let data = JSON.parse(json);
      main(data);
    }
    fileReader.readAsText(file);
  }

  // ドロップ時のイベントハンドラの設定
  let handleDroppedFile = function(event) {
    let file = event.originalEvent.dataTransfer.files[0];
    readFile(file);
    // デフォルトの処理をキャンセル
    cancelEvent(event);
    return false;
  }

  // 選択時のイベントハンドラの設定
  let handleSelectedFile = function(event) {
    if(event.target.value === "") return false;
    let file = event.target.files[0];
    readFile(file);
    // デフォルトの処理をキャンセル
    cancelEvent(event);
    return false;
  }

  // ドロップ時のイベントハンドラの設定
  dropZone.on('drop', handleDroppedFile);
  fileSelector.on('change', handleSelectedFile);
});

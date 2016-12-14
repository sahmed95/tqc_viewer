"use strict";

var findCenterPosition = function(meshes) {
  let max = new THREE.Vector3(0, 0, 0);
  let min = new THREE.Vector3(0, 0, 0);
  for(let mesh of meshes) {
    max.max(mesh.position);
    min.min(mesh.position);
  }
  return max.add(min).divideScalar(2);
};

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
  let controls = new THREE.OrbitControls(camera);

  console.info(controls);

  let renderer = new THREE.WebGLRenderer({antialias: settings.ENABLED_ANTIALIAS});
  renderer.setSize(width, height);
  renderer.setClearColor(new THREE.Color(0xffffff));
  document.getElementById('canvas').appendChild(renderer.domElement);

  let directionalLight = new THREE.DirectionalLight(0xffffff, settings.DIRECTIONAL_LIGHT_LEVEL);
  let ambientLight = new THREE.AmbientLight(0xffffff, settings.AMBIENT_LIGHT_LEVEL);

  let setDirectionalLight = function(from, to) {
    directionalLight.position.copy(from).sub(to).normalize();
    directionalLight.position.y += 0.4;
    directionalLight.position.normalize();
  };

  if(!settings.ENABLED_AUTO_FOLLOWING_LIGHT) {
    directionalLight.position.set(0, -0.5, 0.7);
  }

  scene.add(directionalLight);
  scene.add(ambientLight);

  let CircuitRenderer = function() {
    this.render = function(data) {
      this.circuit = CircuitCreator.create(data);
      this.meshes = this.circuit.create_meshes();

      for(let mesh of this.meshes) {
        scene.add(mesh);
        if(settings.DISPLAY_EDGES_FLAG) {
          let geometry = new THREE.EdgesGeometry(mesh.geometry); // or WireframeGeometry
          let material = new THREE.LineBasicMaterial({color: settings.COLOR_SET.EDGE});
          let edge = new THREE.LineSegments(geometry, material);
          mesh.add(edge);
        }
      }

      controls.reset();
      let centerPosition = findCenterPosition(this.meshes);
      camera.position.setX(centerPosition.x);
      controls.target.set(centerPosition.x, centerPosition.y, 0);
      let bitEvent = new selectBitEvent();
      let moduleEvent = new selectModuleEvent();
      window.onmousedown = clickEvent([bitEvent.intersected, moduleEvent.intersected], bitEvent.constant);
    };

    this.clear = function() {
      for(let mesh of this.meshes) {
        scene.remove(mesh);
        mesh.geometry.dispose();
        mesh.material.dispose();
      }
    };

    this.rerender = function(data) {
      $('canvas').fadeOut('fast', () => {
        this.clear();
        this.render(data);
      }).fadeIn(1000);
    };
  };

  let clickEvent = function(intersectedFunc, constantFunc = [() => {}]) {
    let mouse = {x: 0, y: 0};
    let targetMeshes = circuitRenderer.meshes;
    if(!Array.isArray(intersectedFunc)) intersectedFunc = [intersectedFunc];
    if(!Array.isArray(constantFunc)) constantFunc = [constantFunc];

    let getIntersectMeshes = function(event) {
      let rect = event.target.getBoundingClientRect();
      mouse.x =  event.clientX - rect.left;
      mouse.y =  event.clientY - rect.top;
      mouse.x =  (mouse.x / width) * 2 - 1;
      mouse.y = -(mouse.y / height) * 2 + 1;
      let vector = new THREE.Vector3(mouse.x, mouse.y ,1);
      vector.unproject(camera);
      let ray = new THREE.Raycaster(camera.position, vector.sub(camera.position).normalize());
      return ray.intersectObjects(targetMeshes);
    };

    return function(event) {
      if(event.target != renderer.domElement) return;
      let intersectMeshes = getIntersectMeshes(event);
      for(let func of constantFunc) {
        func(intersectMeshes);
      }
      if(intersectMeshes.length > 0) {
        for(let func of intersectedFunc) {
          func(intersectMeshes);
        }
      }
    };
  };

  let selectBitEvent = function() {
    let changedMeshes = [];

    this.constant = function() {
      for(let mesh of changedMeshes) {
        let material = mesh.material;
        material.color = material.defaultColor;
      }
      changedMeshes = [];
    };

    this.intersected = function(intersectMeshes) {
      if(!('bit_id' in intersectMeshes[0].object)) return;
      let bitId = intersectMeshes[0].object.bit_id;
      console.log('Logical qubit ID: ' + bitId);
      changedMeshes = circuitRenderer.circuit.logical_qubits_map[bitId].meshes;
      for(let mesh of changedMeshes) {
        let material = mesh.material;
        material.defaultColor = material.color.clone();
        material.color.set(settings.COLOR_SET.SELECTED);
      }
    };
  };

  let selectModuleEvent = function() {
    let currentModuleId = 'main';
    let previousModuleId;

    this.intersected = function(intersectMeshes) {
      if(!('module_id' in intersectMeshes[0].object)) return;
      let moduleId = intersectMeshes[0].object.module_id;
      if(!(moduleId in data)) return;
      previousModuleId = currentModuleId;
      currentModuleId = moduleId;
      circuitRenderer.rerender(data[moduleId]);
    };
  };

  let currentData = ('main' in data) ? data.main : data;
  let circuitRenderer = new CircuitRenderer();
  circuitRenderer.render(currentData);

  (function renderLoop() {
    if(settings.ENABLED_AUTO_FOLLOWING_LIGHT) {
      setDirectionalLight(camera.position, controls.target);
    }
    requestAnimationFrame(renderLoop);
    controls.update();
    renderer.render(scene, camera);
  })();
};

var prepareCanvas = function() {
  $('#drop-zone').hide();
  $('#file-selector').hide();
  $('#reset-button').show();
  $('#canvas').show();
};

$(function() {
  let dropZone = $('#drop-zone');
  let fileSelector = $('#file-selector');

  // イベントをキャンセル
  let cancelEvent = function(event) {
    event.preventDefault();
    event.stopPropagation();
    return false;
  };

  // dragenter, dragover イベントのデフォルト処理をキャンセル
  dropZone.on('dragenter', cancelEvent);
  dropZone.on('dragover', cancelEvent);

  // イベントをファイル選択ダイアログの表示に変更
  let openFileSelectionDialog = function(event) {
    fileSelector.click();
    return cancelEvent(event);
  };

  // click イベントをファイル選択ダイアログの表示に変更
  dropZone.on('click', openFileSelectionDialog);

  let readFile = function(file) {
    // ファイルの内容は FileReader で読み込む
    let fileReader = new FileReader();
    fileReader.onload = function(event) {
      // event.target.result に読み込んだファイルの内容が入る
      prepareCanvas();
      let json = event.target.result;
      let data = JSON.parse(json);
      main(data);
    };
    fileReader.readAsText(file);
  };

  // ドロップ時のイベントハンドラの設定
  let handleDroppedFile = function(event) {
    let file = event.originalEvent.dataTransfer.files[0];
    readFile(file);
    // デフォルトの処理をキャンセル
    cancelEvent(event);
    return false;
  };

  // 選択時のイベントハンドラの設定
  let handleSelectedFile = function(event) {
    if(event.target.value === "") return false;
    let file = event.target.files[0];
    readFile(file);
    // デフォルトの処理をキャンセル
    cancelEvent(event);
    return false;
  };

  // ドロップ時のイベントハンドラの設定
  dropZone.on('drop', handleDroppedFile);
  fileSelector.on('change', handleSelectedFile);
});

var loadFile = function(fileName) {
  $.getJSON(fileName, function(data) {
    prepareCanvas();
    main(data);
  });
};

var setSamples = function(settings) {
  let sampleList = 'samples/list.json';

  let markup = '<div class="row">' +
  '<div class="col-md-8"><h6><a href="#" onclick="loadFile(\'samples/${file}\'); hideSamplesModal()">${text}</a></h6></div>' +
  '<div class="col-md-1 offset-md-3">' +
    '<a href="samples/${file}" download="${file}"><img src="images/octicons/cloud-download.svg" /></a>' +
  '</div>' +
  '</div>';

  let navSample = $('#nav-samples');

  $.template('sampleTemplate', markup);

  // サンプルリストの取得に失敗した場合はファイル選択ダイアログ表示
  $.getJSON(sampleList, function(data) {
    $.tmpl("sampleTemplate", data.samples).appendTo("#sample-list");
  })
  .done(function(json) {
    navSample.on('click', showSamplesModal);
  })
  .fail(function(jqXHR, textStatus, errorThrown) {
    navSample.on('click', function() {$('#file-selector').click();});
  });
};

var showSamplesModal = function() {
  $('#samples-modal').modal();
};

var hideSamplesModal = function() {
  $('#samples-modal').modal('hide');
};

var setSettingsForm = function(settings) {
  $('#margin-setting').val(settings.MARGIN);
  $('#color-rough-setting').val(settings.COLOR_SET.ROUGH);
  $('#color-smooth-setting').val(settings.COLOR_SET.SMOOTH);
  if(settings.ENABLED_OVERWRITE_COLORS) $('#color-overwrite-setting').prop('checked', true);
  if(settings.ENABLED_AUTO_FOLLOWING_LIGHT) $('#light-auto-following-setting').prop('checked', true);
  if(settings.DISPLAY_EDGES_FLAG) $('#display-edges-setting').prop('checked', true);
  if(settings.ENABLED_ANTIALIAS) $('#antialias-setting').prop('checked', true);
};

$(function() {
  $('#settings-modal').on('show.bs.modal', setSettingsForm.bind(null, settings));
});

var showSettingsModal = function() {
  $('#settings-modal').modal();
};

var hideSettingsModal = function() {
  $('#settings-modal').modal('hide');
};

var loadSettings = function() {
  let storage = localStorage;

  let margin = storage.getItem('settings.MARGIN');
  let color_set_rough = storage.getItem('settings.COLOR_SET.ROUGH');
  let color_set_smooth = storage.getItem('settings.COLOR_SET.SMOOTH');
  let enabed_overwrite_colors = storage.getItem('settings.ENABLED_OVERWRITE_COLORS');
  let enabed_auto_following_light = storage.getItem('settings.ENABLED_AUTO_FOLLOWING_LIGHT');
  let display_edges_flag = storage.getItem('settings.DISPLAY_EDGES_FLAG');
  let antialias = storage.getItem('settings.ENABLED_ANTIALIAS');

  if(margin) {
    settings.MARGIN = margin;
    settings.PITCH = Number(settings.MARGIN) + 1;
  }
  if(color_set_rough) settings.COLOR_SET.ROUGH = color_set_rough;
  if(color_set_smooth) settings.COLOR_SET.SMOOTH = color_set_smooth;
  if(enabed_overwrite_colors) settings.ENABLED_OVERWRITE_COLORS = Number(enabed_overwrite_colors);
  if(enabed_auto_following_light) settings.ENABLED_AUTO_FOLLOWING_LIGHT = Number(enabed_auto_following_light);
  if(display_edges_flag) settings.DISPLAY_EDGES_FLAG = Number(display_edges_flag);
  if(antialias) settings.ENABLED_ANTIALIAS = Number(antialias);
};

var saveSettings = function() {
  let storage = localStorage;

  storage.setItem('settings.MARGIN', $('#margin-setting').val());
  storage.setItem('settings.COLOR_SET.ROUGH', document.getElementById("color-rough-setting").value);
  storage.setItem('settings.COLOR_SET.SMOOTH', document.getElementById("color-smooth-setting").value);
  storage.setItem('settings.ENABLED_OVERWRITE_COLORS', $('[id=color-overwrite-setting]:checked').val());
  storage.setItem('settings.ENABLED_AUTO_FOLLOWING_LIGHT', $('[id=light-auto-following-setting]:checked').val());
  storage.setItem('settings.DISPLAY_EDGES_FLAG', $('[id=display-edges-setting]:checked').val());
  storage.setItem('settings.ENABLED_ANTIALIAS', $('[id=antialias-setting]:checked').val());

  loadSettings();
};

var defaultSettings = {};

var loadDefaultSettings = function() {
  setSettingsForm(defaultSettings);
};

$(document).ready(function() {
  setSamples();
  defaultSettings = $.extend(true, {}, settings);
  loadSettings();
});

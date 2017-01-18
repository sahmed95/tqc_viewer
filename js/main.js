"use strict";

var showDescriptionText = function(text) {
  let height = window.innerHeight;
  let x = 0;
  let y = height - 100;
  let descriptionArea = $('#description-area');
  descriptionArea.hide().html('<h1>' + text + '</h1>').css({'left': 0, 'top': y}).fadeIn('fast');
};

var hideDescriptionText = function() {
  let descriptionArea = $('#description-area');
  descriptionArea.stop(true);
  $('#description-area').fadeOut('fast');
};

var findMinPosition = function(meshes) {
  let min = new THREE.Vector3(0, 0, 0);
  for(let mesh of meshes) {
    min.min(mesh.position);
  }
  return min;
};

var findMaxPosition = function(meshes) {
  let max = new THREE.Vector3(0, 0, 0);
  for(let mesh of meshes) {
    max.max(mesh.position);
  }
  return max;
};

var calculateSize = function(min, max) {
  return max.clone().sub(min);
};

var calculateCenterPosition = function(min, max) {
  return max.clone().add(min).divideScalar(2);
};

class TransformationManager {
  constructor(circuitRenderer, circuitId, data) {
    Object.assign(this, {circuitRenderer, data});
    this.history = [circuitId];
  }

  transform() {
    let circuitId = this.history[this.history.length - 1];
    this.circuitRenderer.removeAllMeshes();
    this.circuitRenderer.addrender(this.data[circuitId], [0, 0, 0], ['x', 'y', 'z'], circuitId);
  }

  setButtons(data) {
    let nextButton = $('#trans-next-button');
    let prevButton = $('#trans-prev-button');
    nextButton.off('click').css({'visibility': 'hidden'});
    prevButton.off('click').css({'visibility': 'hidden'});
    let transformations = data.transformations;
    if(transformations) {
      let nextCircuitId = transformations.next;
      if(nextCircuitId) {
        nextButton.on('click', () => {this.history.push(nextCircuitId); this.transform();});
        nextButton.css({'visibility': 'visible'});
      }
    }
    if(this.history.length > 1) {
      prevButton.on('click', () => {this.history.pop(); this.transform();});
      prevButton.css({'visibility': 'visible'});
    }
  }
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
  camera.position.set(0, -40, 40);
  let controls = new THREE.OrbitControls(camera);

  let renderer = new THREE.WebGLRenderer({antialias: settings.ENABLED_ANTIALIAS, preserveDrawingBuffer: true});
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
    let dataHistory = [];

    this.getCurrentData = function() {
      return dataHistory[dataHistory.length - 1];
    };

    this.getCircuitsData = function(circuitId) {
      return this.circuitsData[circuitId];
    };

    this.set_min_position = function() {
      this.min_pos = new THREE.Vector3(0, 0, 0);
      let first = true;
      for(let mesh of this.meshes) {
        let pos = mesh.position;
        if(first) {
          this.min_pos.copy(pos);
          first = false;
        }
        this.min_pos.x = Math.min(this.min_pos.x, pos.x);
        this.min_pos.y = Math.min(this.min_pos.y, pos.y);
        this.min_pos.z = Math.min(this.min_pos.z, pos.z);
      }
    };

    this.replace_meshes = function(meshes) {
      for(let mesh of meshes) {
        let pos = mesh.position;
        pos.x -= this.min_pos.x;
        pos.y -= this.min_pos.y;
        pos.z -= this.min_pos.z;
      }
    };

    this.render = function(data, basePosition = [0, 0, 0], rotation = ['x', 'y', 'z'], circuitId = 'main', setCamera = true) {
      let currentData = ('main' in data) ? data.main : data;
      if('circuit' in currentData) currentData = currentData.circuit;

      if(!this.transformationManager) this.transformationManager = new TransformationManager(this, circuitId, data);
      this.transformationManager.setButtons(currentData);

      dataHistory.push([data, basePosition, rotation, circuitId]);
      if(!this.circuitsData) this.circuitsData = {};
      this.circuitsData[circuitId] = this.getCurrentData();

      if(!this.circuits) this.circuits = {};
      this.circuits[circuitId] = CircuitCreator.create(currentData, basePosition, rotation);
      this.meshes = this.circuits[circuitId].create_meshes();
      this.set_min_position();
      this.replace_meshes(this.meshes);
      for(let mesh of this.meshes) {
        mesh['circuitId'] = circuitId;
        scene.add(mesh);
        if(settings.DISPLAY_EDGES_FLAG) {
          let geometry = new THREE.EdgesGeometry(mesh.geometry); // or WireframeGeometry
          let material = new THREE.LineBasicMaterial({color: settings.COLOR_SET.EDGE});
          let edge = new THREE.LineSegments(geometry, material);
          mesh.add(edge);
        }
      }

      if(setCamera) {
        controls.reset();
        let minPosition = findMinPosition(this.meshes);
        let maxPosition = findMaxPosition(this.meshes);
        let size = calculateSize(minPosition, maxPosition);
        let centerPosition = calculateCenterPosition(minPosition, maxPosition);
        camera.position.setX(centerPosition.x);
        camera.position.setY((centerPosition.y - Math.max(size.y, size.z)) * 1.3 * 2);
        camera.position.setZ((centerPosition.z + Math.max(size.y, size.z)) * 1.3);
        controls.target.copy(centerPosition);
      }

      let hoverBitEventInstance = new hoverBitEvent();
      let hoverModuleEventInstance = new hoverModuleEvent();
      let clickModuleEventInstance = new clickModuleEvent();
      let rightClickModuleEventInstance = new rightClickModuleEvent();
      let hoverEventsIntersected = [hoverBitEventInstance.intersected, hoverModuleEventInstance.intersected];
      let hoverEventsNonintersected = [hoverBitEventInstance.nonintersected, hoverModuleEventInstance.nonintersected];

      window.onmousemove = selectEvent(hoverEventsIntersected, hoverEventsNonintersected);
      window.ondblclick = selectEvent(clickModuleEventInstance.intersected);
      window.oncontextmenu = selectEvent(rightClickModuleEventInstance.intersected);

      $('#reset-button').off('click').on('click', () => {this.rerender(...dataHistory.pop());});
      $('#reset-button').css({'visibility': 'visible'});

      if(dataHistory.length > 1) {
        $('#back-button').off('click').on('click', () => {dataHistory.pop(); this.rerender(...dataHistory.pop());});
        $('#back-button').css({'visibility': 'visible'});
      }
      else {
        $('#back-button').css({'visibility': 'hidden'});
      }
    };

    this.clear = function() {
      for(let mesh of this.meshes) {
        scene.remove(mesh);
        mesh.geometry.dispose();
        mesh.material.dispose();
      }
      this.meshes = [];
      this.circuitsData = {};
    };

    this.rerender = function(...args) {
      $('#reset-button').off('click');
      $('#back-button').off('click');
      hideDescriptionText();
      $('canvas').fadeOut('fast', () => {
        this.clear();
        this.render(...args);
      }).fadeIn(1000);
    };

    this.removeMesh = function(mesh) {
      for(let i = 0; i < this.meshes.length; ++i) {
        if(mesh === this.meshes[i]) {
          scene.remove(mesh);
          mesh.geometry.dispose();
          mesh.material.dispose();
          this.meshes.splice(i, 1);
          return;
        }
      }
    };

    this.removeAllMeshes = function() {
      for(let mesh of this.meshes) {
        scene.remove(mesh);
        mesh.geometry.dispose();
        mesh.material.dispose();
      }
      this.meshes = [];
    };

    this.removeMeshes = function(meshes) {
      if(!meshes) return this.removeAllMeshes();
      for(let mesh of meshes) {
        this.removeMesh(mesh);
      }
    };

    this.removeModuleMesh = function(circuitId, moduleId) {
      for(let i = 0; i < this.meshes.length; ++i) {
      //for(let mesh of this.meshes) {
        let mesh = this.meshes[i];
        if(('module_id' in mesh) && mesh.circuitId === circuitId && mesh.module_id === moduleId) {
          scene.remove(mesh);
          mesh.geometry.dispose();
          mesh.material.dispose();
          this.meshes.splice(i, 1);
          return;
        }
      }
    };

    this.addrender = function(data, basePosition = [0, 0, 0], rotation = ['x', 'y', 'z'], circuitId = 'main') {
      let currentData = ('main' in data) ? data.main : data;
      if('circuit' in currentData) currentData = currentData.circuit;

      if(!this.transformationManager) this.transformationManager = new TransformationManager(this, circuitId, data);
      this.transformationManager.setButtons(currentData);

      this.circuitsData[circuitId] = [data, basePosition, rotation, circuitId];

      this.circuits[circuitId] = CircuitCreator.create(currentData, basePosition, rotation);
      let newMeshes = this.circuits[circuitId].create_meshes();
      this.replace_meshes(newMeshes);
      for(let mesh of newMeshes) {
        mesh['circuitId'] = circuitId;
        scene.add(mesh);
        if(settings.DISPLAY_EDGES_FLAG) {
          let geometry = new THREE.EdgesGeometry(mesh.geometry); // or WireframeGeometry
          let material = new THREE.LineBasicMaterial({color: settings.COLOR_SET.EDGE});
          let edge = new THREE.LineSegments(geometry, material);
          mesh.add(edge);
        }
      }
      this.meshes.push(...newMeshes);

      let hoverBitEventInstance = new hoverBitEvent();
      let hoverModuleEventInstance = new hoverModuleEvent();
      let clickModuleEventInstance = new clickModuleEvent();
      let rightClickModuleEventInstance = new rightClickModuleEvent();
      let hoverEventsIntersected = [hoverBitEventInstance.intersected, hoverModuleEventInstance.intersected];
      let hoverEventsNonintersected = [hoverBitEventInstance.nonintersected, hoverModuleEventInstance.nonintersected];

      window.onmousemove = selectEvent(hoverEventsIntersected, hoverEventsNonintersected);
      window.ondblclick = selectEvent(clickModuleEventInstance.intersected);
      window.oncontextmenu = selectEvent(rightClickModuleEventInstance.intersected);
    };
  };

  let selectEvent = function(intersectedFunc, nonintersectedFunc = [() => {}], constantFunc = [() => {}]) {
    let mouse = {x: 0, y: 0};
    let targetMeshes = circuitRenderer.meshes;
    if(!Array.isArray(intersectedFunc)) intersectedFunc = [intersectedFunc];
    if(!Array.isArray(nonintersectedFunc)) nonintersectedFunc = [nonintersectedFunc];
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
      else {
        for(let func of nonintersectedFunc) {
          func();
        }
      }
    };
  };

  let hoverBitEvent = function() {
    let changedMeshes = [];
    let previousCircuitId = undefined;
    let previousBitId = undefined;

    let clear = function(meshes = [], circuitId = undefined, bitId = undefined) {
      for(let mesh of changedMeshes) {
        let material = mesh.material;
        material.color = material.defaultColor;
      }
      changedMeshes = meshes;
      previousCircuitId = circuitId;
      previousBitId = bitId;
    };

    this.intersected = function(intersectMeshes) {
      let intersectMesh = intersectMeshes[0].object;
      if(!('bit_id' in intersectMesh)) return clear();
      let circuitId = intersectMesh.circuitId;
      let bitId = intersectMesh.bit_id;
      if(circuitId === previousCircuitId && bitId === previousBitId) return;
      else {
        clear(circuitRenderer.circuits[circuitId].logical_qubit_meshes_map[bitId], circuitId, bitId);
        for(let mesh of changedMeshes) {
          let material = mesh.material;
          material.defaultColor = material.color.clone();
          material.color.set(settings.COLOR_SET.SELECTED);
        }
        console.log('Logical qubit ID: ' + bitId);
      }
    };

    this.nonintersected = function() {
      clear();
    }
  };

  let hoverModuleEvent = function() {
    let changedMeshes = [];
    let previousCircuitId = undefined;
    let previousModuleId = undefined;

    let clear = function(meshes = [], circuitId = undefined, moduleId = undefined) {
      for(let mesh of changedMeshes) {
        let material = mesh.material;
        material.color = material.defaultColor;
      }
      changedMeshes = meshes;
      previousCircuitId = circuitId;
      previousModuleId = moduleId;
      hideDescriptionText();
    };

    this.intersected = function(intersectMeshes) {
      let intersectMesh = intersectMeshes[0].object;
      if(!('module_id' in intersectMesh)) return clear();
      let circuitId = intersectMesh.circuitId;
      let moduleId = intersectMesh.module_id;
      if(circuitId === previousCircuitId && moduleId === previousModuleId) return;
      else {
        clear([intersectMesh], circuitId, moduleId);
        for(let mesh of changedMeshes) {
          let material = mesh.material;
          material.defaultColor = material.color.clone();
          material.color.set(settings.COLOR_SET.SELECTED);
        }
        let moduleRawData = intersectMesh.raw_data;
        let text = ('description' in moduleRawData) ? moduleRawData.description : moduleId;
        showDescriptionText(text);
        console.log('Module ID: ' + moduleId);
      }
    };

    this.nonintersected = function() {
      clear();
    }
  };

  let clickModuleEvent = function() {
    let loadFile = function(moduleId, basePosition, rotation, newCircuitId = 'main') {
      let fileName = 'samples/' + moduleId + '.json';
      $.getJSON(fileName, function(data) {
        circuitRenderer.rerender(data, basePosition, rotation, newCircuitId);
      })
      .fail(function(jqXHR, textStatus, errorThrown) {
        console.error('Not found a module: ' + moduleId);
      });
    };

    this.intersected = function(intersectMeshes) {
      let intersectMesh = intersectMeshes[0].object;
      if(!('module_id' in intersectMesh)) return;
      let circuitId = intersectMesh.circuitId;
      let moduleId = intersectMesh.module_id;
      let newCircuitId = circuitId + '_' + moduleId;
      let rotation = intersectMesh.raw_data.rotation;
      console.info(intersectMesh.raw_data.rotation);
      if(moduleId in data) circuitRenderer.rerender(data[moduleId], [0, 0, 0], rotation, newCircuitId);
      else                 loadFile(moduleId, [0, 0, 0], rotation, newCircuitId);
    };
  };

  let rightClickModuleEvent = function() {
    let loadFile = function(moduleId, basePosition, rotation, newCircuitId, circuitId = 'main') {
      let fileName = 'samples/' + moduleId + '.json';
      $.getJSON(fileName, function(data) {
        circuitRenderer.removeModuleMesh(circuitId, moduleId);
        circuitRenderer.addrender(data, basePosition, rotation, newCircuitId);
      })
      .fail(function(jqXHR, textStatus, errorThrown) {
        console.error('Not found a module: ' + moduleId);
      });
    };

    let calculateBasePosition = function(basePosition, circuitId) {
      let currentBasePosition = circuitRenderer.getCircuitsData(circuitId)[1];
      console.info(basePosition);
      console.info(currentBasePosition);
      for(let i = 0; i < 3; ++i) {
        basePosition[i] += currentBasePosition[i];
      }
      return basePosition;
    };

    this.intersected = function(intersectMeshes) {
      let intersectMesh = intersectMeshes[0].object;
      if(!('module_id' in intersectMesh)) return;
      let circuitId = intersectMesh.circuitId;
      let moduleId = intersectMesh.module_id;
      let newCircuitId = circuitId + '_' + moduleId;
      let basePosition = calculateBasePosition(intersectMesh.raw_data.position, circuitId);
      let rotation = intersectMesh.raw_data.rotation;
      if(moduleId in data) {
        CircuitRenderer.removeModuleMesh(circuitId, moduleId);
        circuitRenderer.addrender(data[moduleId], basePosition, rotation, newCircuitId);
      }
      else {
        loadFile(moduleId, basePosition, rotation, newCircuitId, circuitId);
      }
    };
  };

  let circuitRenderer = new CircuitRenderer();
  circuitRenderer.render(data);

  console.info($('#canvas'));
  $('#export-button').off('click').on('click', () => {
    let canvas = $('#canvas').get(0).firstChild;
    let context = canvas.getContext("experimental-webgl", {preserveDrawingBuffer: true});
    window.open(canvas.toDataURL('image/png'), '_blank');
  });
  $('#export-button').css('visibility', 'visible');

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
  $('#reset-button').css({'visibility': 'visible'});
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

import * as ws from 'webgpu-simplified';
import fsShader from './shader-frag.wgsl';
import { createPipeline, draw } from './ch01-common';
import { getSphereData } from '../../common/vertex-data';
import { vec3, mat4 } from 'gl-matrix';

export const run = async () => {
    const canvas = document.getElementById('canvas-webgpu') as HTMLCanvasElement;
    const init = await ws.initWebGPU({canvas, msaaCount: 4});

    const data = getSphereData(2, 20, 32);
    const p = await createPipeline(init, data, fsShader);

    let modelMat = mat4.create();
    let normalMat = mat4.create();
    let vt = ws.createViewTransform();
    let viewMat = vt.viewMat;
   
    let aspect = init.size.width / init.size.height;  
    let rotation = vec3.fromValues(0, 0, 0); 
    let projectMat = ws.createProjectionMat(aspect);
    let vpMat = ws.combineVpMat(viewMat, projectMat);    
    init.device.queue.writeBuffer(p.uniformBuffers[0], 0, vpMat as ArrayBuffer);

    var camera = ws.getCamera(canvas, vt.cameraOptions);
    let eyePosition = new Float32Array(vt.cameraOptions.eye);
    let lightDirection = new Float32Array([-0.5, -0.5, -0.5]);

    // write light parameters to buffer 
    init.device.queue.writeBuffer(p.uniformBuffers[1], 0, lightDirection);
    init.device.queue.writeBuffer(p.uniformBuffers[1], 16, eyePosition);

    var gui = ws.getDatGui();
    const params = {
        rotationSpeed: 0.9,
        selectImage: 'earth.png',
        specularColor: '#aaaaaa',
        ambient: 0.2,
        diffuse: 0.8,
        specular: 0.4,
        shininess: 30,
    };
    
    let dataChanged = true;
   
    const img = require('../../assets/images/earth.png');
    var td = await ws.createImageTexture(init.device, img);
    var textureBindGroup = ws.createBindGroup(init.device, p.pipelines[0].getBindGroupLayout(2),
        [], [td.sampler, td.texture.createView()]);
    
    gui.add(params, 'selectImage', [
        'earth.png', 'brick.png', 'grass.png', 'marble.png', 'wood.png'
    ]).onChange((val:string) => {
        const img = require('../../assets/images/' + val);
        ws.createImageTexture(init.device, img).then(res => {
            textureBindGroup = ws.createBindGroup(init.device, p.pipelines[0].getBindGroupLayout(2),
                [], [res.sampler, res.texture.createView()]);
        });
    });
    gui.add(params, 'rotationSpeed', 0, 5, 0.1);      
   
    var folder = gui.addFolder('Set lighting parameters');
    folder.open();
    folder.add(params, 'ambient', 0, 1, 0.02).onChange(() => { dataChanged = true; });  
    folder.add(params, 'diffuse', 0, 1, 0.02).onChange(() => { dataChanged = true; });  
    folder.add(params, 'specular', 0, 1, 0.02).onChange(() => { dataChanged = true; });  
    folder.addColor(params, 'specularColor').onChange(() => { dataChanged = true; });
    folder.add(params, 'shininess', 0, 300, 1).onChange(() => { dataChanged = true; });  
   
    var stats = ws.getStats();
    let start = Date.now();
    const frame = () => {     
        stats.begin(); 
        
        if(camera.tick()){
            viewMat = camera.matrix;
            vpMat = ws.combineVpMat(viewMat, projectMat);
            eyePosition = new Float32Array(camera.eye.flat());
            init.device.queue.writeBuffer(p.uniformBuffers[0], 0, vpMat as ArrayBuffer);
            init.device.queue.writeBuffer(p.uniformBuffers[1], 16, eyePosition);
        }
        var dt = (Date.now() - start)/1000;             
        rotation[0] = Math.sin(dt * params.rotationSpeed);
        rotation[1] = Math.cos(dt * params.rotationSpeed); 
        
        modelMat = ws.createModelMat([0,0,0], rotation);
        normalMat = ws.createNormalMat(modelMat);
       
        // update uniform buffers for transformation 
        init.device.queue.writeBuffer(p.uniformBuffers[0], 64, modelMat as ArrayBuffer);  
        init.device.queue.writeBuffer(p.uniformBuffers[0], 128, normalMat as ArrayBuffer);  

        if(dataChanged){
            // update uniform buffers for light 
            init.device.queue.writeBuffer(p.uniformBuffers[1], 32, ws.hex2rgb(params.specularColor));
        
            // update uniform buffer for material
            init.device.queue.writeBuffer(p.uniformBuffers[2], 0, new Float32Array([
                params.ambient, params.diffuse, params.specular, params.shininess
            ]));
            dataChanged = false;
        }

        draw(init, p, textureBindGroup, data);   
        
        requestAnimationFrame(frame);
        stats.end();
    };
    frame();
}
run();

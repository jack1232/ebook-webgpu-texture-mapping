import * as ws from 'webgpu-simplified';
import fsShader from '../ch01/shader-frag.wgsl';
import { createPipeline, draw } from '../ch01/ch01-common';
import { getCubeData } from '../../common/vertex-data';
import { vec3, mat4 } from 'gl-matrix';
import { drawText } from './canvas-data';

export const run = async () => {
    const canvas = document.getElementById('canvas-webgpu') as HTMLCanvasElement;
    const init = await ws.initWebGPU({canvas, msaaCount: 4});

    let data = getCubeData(2.5);
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
        animateSpeed: 1,
        starShape: 5,
        starColor: '#00aa00',
        
        specularColor: '#aaaaaa',
        ambient: 0.2,
        diffuse: 0.8,
        specular: 0.4,
        shininess: 30,
        size: 2.5,
    };
    
    let dataChanged = true;
    
    gui.add(params, 'starShape', 3, 20, 1);
    gui.add(params, 'starColor');

    gui.add(params, 'size', 1, 5, 0.1).onChange(() => { dataChanged = true; }); 
    gui.add(params, 'rotationSpeed', 0, 5, 0.1);   
    gui.add(params, 'animateSpeed', 0, 5, 0.1);   
   
    var folder = gui.addFolder('Set lighting parameters');
    folder.open();
    folder.add(params, 'ambient', 0, 1, 0.02).onChange(() => { dataChanged = true; });  
    folder.add(params, 'diffuse', 0, 1, 0.02).onChange(() => { dataChanged = true; });  
    folder.add(params, 'specular', 0, 1, 0.02).onChange(() => { dataChanged = true; });  
    folder.addColor(params, 'specularColor').onChange(() => { dataChanged = true; });
    folder.add(params, 'shininess', 0, 300, 1).onChange(() => { dataChanged = true; });  

    const ctx = document.createElement('canvas').getContext('2d', {willReadFrequently: true});
    ctx.canvas.width = init.size.width;
    ctx.canvas.height = init.size.height;
    
    var ts = await ws.createCanvasTexture(init.device, ctx.canvas);
    var textureBindGroup = ws.createBindGroup(init.device, p.pipelines[0].getBindGroupLayout(2),
        [], [ts.sampler, ts.texture.createView()]);
   
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
        
        drawText(ctx, dt * params.animateSpeed * 2, params.starColor, params.starShape);
        init.device.queue.copyExternalImageToTexture(
            { source: ctx.canvas, flipY: true }, 
            { texture: ts.texture }, 
            init.size
        );

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

            // update vertex and index buffers
            const len0 = data.positions.length;
            data = getCubeData(params.size, 1, 1);            
            const pData = [data.positions, data.normals, data.uvs, data.indices];
            ws.updateVertexBuffers(init.device, p, pData, len0);
            dataChanged = false;
        }

        draw(init, p, textureBindGroup, data);   
        
        requestAnimationFrame(frame);
        stats.end();
    };
    frame();
}

run();
import * as ws from 'webgpu-simplified';
import vsShader from './normal-vert.wgsl';
import fsShader from './parallax-frag.wgsl';
import { getCubeData, getTangentData } from '../../common/vertex-data';
import { vec3, mat4 } from 'gl-matrix';

export const createPipeline = async (init:ws.IWebGPUInit, data:any, tdata:any): Promise<ws.IPipeline> => { 
    const descriptor = ws.createRenderPipelineDescriptor({
        init, vsShader, fsShader,
        buffers: ws.setVertexBuffers([
            'float32x3', 'float32x3', 'float32x2', 'float32x3', 'float32x3']), //pos, norm, uv, tan, bitan 
    })
    const pipeline = await init.device.createRenderPipelineAsync(descriptor);

    // create vertex and index buffers
    const vertexBuffer = ws.createBufferWithData(init.device, data.positions);
    const normalBuffer = ws.createBufferWithData(init.device, data.normals);
    const uvBuffer = ws.createBufferWithData(init.device, data.uvs);
    const indexBuffer = ws.createBufferWithData(init.device, data.indices); 
    const tangentBuffer = ws.createBufferWithData(init.device, tdata.tangents);
    const biTangentBuffer = ws.createBufferWithData(init.device, tdata.bitangents);
   
    // uniform buffer for transform matrix
    const uniformBuffer = ws.createBuffer(init.device, 192);

    // uniform buffer for light in vertex shader
    const lightVertUniformBuffer = ws.createBuffer(init.device, 32);

     // uniform buffer for light in fragment shader
     const lightUniformBuffer = ws.createBuffer(init.device, 16);
    
    // uniform buffer for material
    const materialUniformBuffer = ws.createBuffer(init.device, 24);
    
    // uniform bind group for vertex shader
    const vertBindGroup = ws.createBindGroup(init.device, pipeline.getBindGroupLayout(0), 
        [uniformBuffer, lightVertUniformBuffer]);
    
    // uniform bind group for fragment shader
    const fragBindGroup = ws.createBindGroup(init.device, pipeline.getBindGroupLayout(1), 
        [lightUniformBuffer, materialUniformBuffer]);

    // create depth view
    const depthTexture = ws.createDepthTexture(init);

    // create texture view for MASS (count = 4)
    const msaaTexture = ws.createMultiSampleTexture(init);

    return {
        pipelines: [pipeline],
        vertexBuffers: [
            vertexBuffer, normalBuffer, uvBuffer, tangentBuffer, biTangentBuffer, indexBuffer   
        ],
        uniformBuffers: [
            uniformBuffer,        // for vertex
            lightVertUniformBuffer,
            lightUniformBuffer,   // for fragmnet
            materialUniformBuffer      
        ],
        uniformBindGroups: [vertBindGroup, fragBindGroup],
        depthTextures: [depthTexture],
        gpuTextures: [msaaTexture],
    };
}

export const draw = (init:ws.IWebGPUInit, p:ws.IPipeline, textureBindGroup:GPUBindGroup, data:any) => {  
    const commandEncoder =  init.device.createCommandEncoder();
    const descriptor = ws.createRenderPassDescriptor({
        init,
        depthView: p.depthTextures[0].createView(),
        textureView: p.gpuTextures[0].createView(),
    });
    const renderPass = commandEncoder.beginRenderPass(descriptor);

    // draw shape
    renderPass.setPipeline(p.pipelines[0]);
    renderPass.setVertexBuffer(0, p.vertexBuffers[0]);
    renderPass.setVertexBuffer(1, p.vertexBuffers[1]);
    renderPass.setVertexBuffer(2, p.vertexBuffers[2]);
    renderPass.setVertexBuffer(3, p.vertexBuffers[3]);
    renderPass.setVertexBuffer(4, p.vertexBuffers[4]);
    renderPass.setBindGroup(0, p.uniformBindGroups[0]);
    renderPass.setBindGroup(1, p.uniformBindGroups[1]);
    renderPass.setBindGroup(2, textureBindGroup);
    renderPass.setIndexBuffer(p.vertexBuffers[5], 'uint32');
    renderPass.drawIndexed(data.indices.length);

    renderPass.end();
    init.device.queue.submit([commandEncoder.finish()]);
}

export const run = async () => {
    const canvas = document.getElementById('canvas-webgpu') as HTMLCanvasElement;
    const init = await ws.initWebGPU({canvas, msaaCount: 4});

    let data = getCubeData(2.5);
    let tdata = getTangentData(data);
    const p = await createPipeline(init, data, tdata);

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
    let lightPosition = eyePosition;

    // write light parameters to buffer 
    init.device.queue.writeBuffer(p.uniformBuffers[1], 0, lightPosition);
    init.device.queue.writeBuffer(p.uniformBuffers[1], 16, eyePosition);

    var gui = ws.getDatGui();
    const params = {
        rotationSpeed: 0.9,
        withGammaCorrection: false,
        heightScale: 0.01,
        specularColor: '#aaaaaa',
        ambient: 0.2,
        diffuse: 0.8,
        specular: 0.4,
        shininess: 30,
        size: 2.5,
        uLength: 1,
        vLength: 1,
    };
    
    let withGammaCorrection = 0;
    let dataChanged = true;
   
    const img = require('../../assets/images/brick1.png');
    const imgNormal = require('../../assets/images/brick1-normal.png');
    const imgHeight = require('../../assets/images/brick1-height.png');
    var td = await ws.createImageTexture(init.device, img);
    var tdNormal = await ws.createImageTexture(init.device, imgNormal);
    var tdHeight = await ws.createImageTexture(init.device, imgHeight);
    var textureBindGroup = ws.createBindGroup(init.device, p.pipelines[0].getBindGroupLayout(2), [], 
        [td.sampler, td.texture.createView(), 
         tdNormal.sampler, tdNormal.texture.createView(),
         tdHeight.sampler, tdHeight.texture.createView()]);

    gui.add(params, 'uLength', 0.1, 5, 0.1).onChange(() => { dataChanged = true; }); 
    gui.add(params, 'vLength', 0.1, 5, 0.1).onChange(() => { dataChanged = true; }); 
    gui.add(params, 'size', 1, 5, 0.1).onChange(() => { dataChanged = true; }); 
    gui.add(params, 'heightScale', 0, 0.02, 0.001).onChange(() => { dataChanged = true; });  
    gui.add(params, 'rotationSpeed', 0, 5, 0.1);      
   
    var folder = gui.addFolder('Set lighting parameters');
    folder.open();
    folder.add(params, 'withGammaCorrection').onChange((val) => { 
        withGammaCorrection = (val === true)? 1 : 0;
        dataChanged = true; 
    });  
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
            lightPosition = eyePosition;
            init.device.queue.writeBuffer(p.uniformBuffers[0], 0, vpMat as ArrayBuffer);
            init.device.queue.writeBuffer(p.uniformBuffers[1], 0, lightPosition);
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
            init.device.queue.writeBuffer(p.uniformBuffers[2], 0, ws.hex2rgb(params.specularColor));
        
            // update uniform buffer for material
            init.device.queue.writeBuffer(p.uniformBuffers[3], 0, new Float32Array([
                params.ambient, params.diffuse, params.specular, params.shininess, 
                withGammaCorrection, params.heightScale
            ]));

            // update vertex and index buffers
            const len0 = data.positions.length;
            data = getCubeData(params.size, params.uLength, params.vLength);  
            let tdata = getTangentData(data);          
            const pData = [data.positions, data.normals, data.uvs, tdata.tangents, tdata.bitangents, data.indices];
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
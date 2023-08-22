import vsShader from './shader-vert.wgsl';
import * as ws from 'webgpu-simplified';

export const createPipeline = async (init:ws.IWebGPUInit, data:any, fsShader:string): Promise<ws.IPipeline> => { 
    const descriptor = ws.createRenderPipelineDescriptor({
        init, vsShader, fsShader,
        buffers: ws.setVertexBuffers(['float32x3', 'float32x3', 'float32x2']),//pos, norm, uv 
    })
    const pipeline = await init.device.createRenderPipelineAsync(descriptor);

    // create vertex and index buffers
    const vertexBuffer = ws.createBufferWithData(init.device, data.positions);
    const normalBuffer = ws.createBufferWithData(init.device, data.normals);
    const uvBuffer = ws.createBufferWithData(init.device, data.uvs);
    const indexBuffer = ws.createBufferWithData(init.device, data.indices); 
   
    // uniform buffer for transform matrix
    const uniformBuffer = ws.createBuffer(init.device, 192);

    // uniform buffer for light 
    const lightUniformBuffer = ws.createBuffer(init.device, 48);
    
    // uniform buffer for material
    const materialUniformBuffer = ws.createBuffer(init.device, 16);
    
    // uniform bind group for vertex shader
    const vertBindGroup = ws.createBindGroup(init.device, pipeline.getBindGroupLayout(0), 
    [uniformBuffer]);
    
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
            vertexBuffer, normalBuffer, uvBuffer, indexBuffer,   
        ],
        uniformBuffers: [
            uniformBuffer,        // for vertex
            lightUniformBuffer,   // for fragmnet
            materialUniformBuffer      
        ],
        uniformBindGroups: [vertBindGroup, fragBindGroup],
        depthTextures: [depthTexture],
        gpuTextures: [msaaTexture],
    };
}

export const draw = (init:ws.IWebGPUInit, p:ws.IPipeline, textureBindGroup:GPUBindGroup, 
data:any, textureBindGroup2:GPUBindGroup = undefined) => {  
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
    renderPass.setBindGroup(0, p.uniformBindGroups[0]);
    renderPass.setBindGroup(1, p.uniformBindGroups[1]);
    renderPass.setBindGroup(2, textureBindGroup);
    if (textureBindGroup2) {
        renderPass.setBindGroup(3, textureBindGroup2);
    }
    renderPass.setIndexBuffer(p.vertexBuffers[3], 'uint32');
    renderPass.drawIndexed(data.indices.length);

    renderPass.end();
    init.device.queue.submit([commandEncoder.finish()]);
}

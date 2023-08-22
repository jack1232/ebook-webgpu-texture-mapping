import { vec3, vec2 } from 'gl-matrix';
const pi = 3.141592653589793;

export const getTangentData = (data: any) => {
    let pos:vec3, uv:vec2, norm:vec3, tang:vec3, bitang:vec3, vertices = [];
    for(let i =0; i < data.positions.length/3; i++){
        pos = vec3.fromValues(data.positions[i*3], data.positions[i*3+1], data.positions[i*3+2]);
        uv = vec2.fromValues(data.uvs[i*2], data.uvs[i*2+1]);
        norm = vec3.fromValues(data.normals[i*3], data.normals[i*3+1], data.normals[i*3+2]);
        tang = vec3.fromValues(0, 0, 0);
        bitang = vec3.fromValues(0, 0, 0);

        vertices.push({
            position: pos,
            uv: uv,
            normal: norm,
            tangent: tang,
            bitangent: bitang,
        });
    }
    
    let triangles = Array(vertices.length).fill(0);
    for(let i = 0; i < data.indices.length; i += 3){
        const c = data.indices.slice(i, i+3);
        let v0 = vertices[c[0]];
        let v1 = vertices[c[1]];
        let v2 = vertices[c[2]];        
        let pos0 = v0.position;
        let pos1 = v1.position;
        let pos2 = v2.position;
        let uv0 = v0.uv;
        let uv1 = v1.uv;
        let uv2 = v2.uv;

        let dp1 = vec3.subtract(vec3.create(), pos1, pos0);
        let dp2 = vec3.subtract(vec3.create(), pos2, pos0);
        let duv1 = vec2.subtract(vec2.create(), uv1, uv0);
        let duv2 = vec2.subtract(vec2.create(), uv2, uv0);

        let d = 1/(duv1[0]*duv2[1] - duv1[1]*duv2[0]);
        let tangent = vec3.fromValues(
            (dp1[0]*duv2[1] - dp2[0]*duv1[1])*d, 
            (dp1[1]*duv2[1] - dp2[1]*duv1[1])*d, 
            (dp1[2]*duv2[1] - dp2[2]*duv1[1])*d
        );
        let bitangent = vec3.fromValues(
            (dp2[0]*duv1[0] - dp1[0]*duv2[0])*(-d), 
            (dp2[1]*duv1[0] - dp1[1]*duv2[0])*(-d), 
            (dp2[2]*duv1[0] - dp1[2]*duv2[0])*(-d)
        );
        
        vertices[c[0]].tangent = vec3.add(vec3.create(), tangent, vertices[c[0]].tangent);
        vertices[c[1]].tangent = vec3.add(vec3.create(), tangent, vertices[c[1]].tangent);
        vertices[c[2]].tangent = vec3.add(vec3.create(), tangent, vertices[c[2]].tangent);
        vertices[c[0]].bitangent = vec3.add(vec3.create(), bitangent, vertices[c[0]].bitangent);
        vertices[c[1]].bitangent = vec3.add(vec3.create(), bitangent, vertices[c[1]].bitangent);
        vertices[c[2]].bitangent = vec3.add(vec3.create(), bitangent, vertices[c[2]].bitangent);

        triangles[c[0]] += 1;
        triangles[c[1]] += 1;
        triangles[c[2]] += 1;
    }

    // average tangents and bitangents
    let n = 1;
    for(let i = 0; i < triangles.length; i++){
        n = triangles[i];
        vertices[i].tangent = vec3.scale(vec3.create(), vertices[i].tangent, 1/n);
        vertices[i].bitangent = vec3.scale(vec3.create(), vertices[i].bitangent, 1/n);
    }

    // Gram-Schmidt orthogonalization
    for(let i = 0; i < vertices.length; i++){
        let v = vertices[i];
        let n = v.normal;
        let t = v.tangent;
        let b = v.bitangent;
        
        // calculate t1
        let dot_tn = vec3.dot(t, n);
        let t1 = vec3.scale(vec3.create(), n, dot_tn);
        vec3.subtract(t1, t, t1);
        vec3.normalize(t1, t1);

        // calculate b1
        let dot_bn = vec3.dot(b, n);
        let dot_bt = vec3.dot(b, t1);
        let b_bn = vec3.scale(vec3.create(), n, dot_bn);
        let b_bt = vec3.scale(vec3.create(), t1, dot_bt);
        let b1 = vec3.subtract(vec3.create(), b, b_bn);
        vec3.subtract(b1, b1, b_bt);
        vec3.normalize(b1, b1);

        v.tangent = t1;
        v.bitangent = b1;
    }

    let tangents = [], bitangents = [];
    for(let i = 0; i < vertices.length; i++){
        tangents.push(vertices[i].tangent[0], vertices[i].tangent[1], vertices[i].tangent[2]);
        bitangents.push(vertices[i].bitangent[0], vertices[i].bitangent[1], vertices[i].bitangent[2]);
    }

    return {
        tangents : new Float32Array(tangents), 
        bitangents: new Float32Array(bitangents),
    }
}

export const getCubeUv = () => {
    return new Float32Array([
        1/3, 1, 2/3, 1, 1/3, 1/2, 2/3, 1/2,     // right
        0, 1/2, 1/3, 1/2, 0, 0, 1/3, 0,         // left
        1/3, 1/2, 2/3, 1/2, 1/3, 0, 2/3, 0,     // top
        2/3, 1/2, 1, 1/2, 2/3, 0, 1, 0,         // bottom
        0, 1, 1/3, 1, 0, 1/2, 1/3, 1/2,         // front
        2/3, 1, 1, 1, 2/3, 1/2, 1, 1/2          // back
   ]);
}


const getSpherePosition = (radius:number, theta:number, phi:number): vec3 => {
    // note theta, phi must in radians
    let x = radius * Math.sin(theta) * Math.cos(phi);
    let y = radius * Math.cos(theta);
    let z = -radius * Math.sin(theta) * Math.sin(phi);    
    return vec3.fromValues(x, y, z);     
}

export const getSphereData = (radius:number, u:number, v:number) => {
    if(u < 2 || v < 2) return;
    let pts = [], normals = [], uvs = [];
    for(let i = 0; i <= u; i++){
        for(let j = 0; j <= v; j++){
            let pt = getSpherePosition(radius, i*pi/u, j*2*pi/v);
            pts.push(pt[0], pt[1], pt[2]);
            normals.push(pt[0]/radius, pt[1]/radius, pt[2]/radius);
            uvs.push(i/u, j/v);
        }
    }

    let n_vertices_per_row = v + 1;
    let indices = [];
    let indices2 = [];

    for(let i = 0; i < u; i++){
        for(let j = 0; j < v; j++) {
            let idx0 = j + i * n_vertices_per_row;
            let idx1 = j + 1 + i * n_vertices_per_row;
            let idx2 = j + 1 + (i + 1) * n_vertices_per_row;
            let idx3 = j + (i + 1) * n_vertices_per_row; 

            indices.push(idx0, idx1, idx2, idx2, idx3, idx0);          
            indices2.push(idx0, idx1, idx0, idx3);      
        }
    }
    return {
        positions: new Float32Array(pts),
        normals: new Float32Array(normals),
        uvs: new Float32Array(uvs),
        indices: new Uint32Array(indices),
        indices2: new Uint32Array(indices2),
    };
}


export const getCubeData = (side = 2, uLength = 1, vLength = 1) => {
    let s2 = side / 2;
    let positions = new Float32Array([
        s2,  s2,  s2,   // index 0
        s2,  s2, -s2,   // index 1
        s2, -s2,  s2,   // index 2
        s2, -s2, -s2,   // index 3
       -s2,  s2, -s2,   // index 4
       -s2,  s2,  s2,   // index 5
       -s2, -s2, -s2,   // index 6
       -s2, -s2,  s2,   // index 7
       -s2,  s2, -s2,   // index 8
        s2,  s2, -s2,   // index 9
       -s2,  s2,  s2,   // index 10
        s2,  s2,  s2,   // index 11
       -s2, -s2,  s2,   // index 12
        s2, -s2,  s2,   // index 13
       -s2, -s2, -s2,   // index 14
        s2, -s2, -s2,   // index 15
       -s2,  s2,  s2,   // index 16
        s2,  s2,  s2,   // index 17
       -s2, -s2,  s2,   // index 18
        s2, -s2,  s2,   // index 19
        s2,  s2, -s2,   // index 20
       -s2,  s2, -s2,   // index 21
        s2, -s2, -s2,   // index 22
       -s2, -s2, -s2,   // index 23
    ]); 

    let colors = new Float32Array([
        1, 1, 1, 1, 1, 0, 1, 0, 1, 1, 0, 0,
        0, 1, 0, 0, 1, 1, 0, 0, 0, 0, 0, 1,
        0, 1, 0, 1, 1, 0, 0, 1, 1, 1, 1, 1,
        0, 0, 1, 1, 0, 1, 0, 0, 0, 1, 0, 0,
        0, 1, 1, 1, 1, 1, 0, 0, 1, 1, 0, 1,
        1, 1, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0
    ]);

    let normals = new Float32Array([
        1,  0,  0,  1,  0,  0,  1,  0,  0,  1,  0,  0,
       -1,  0,  0, -1,  0,  0, -1,  0,  0, -1,  0,  0,
        0,  1,  0,  0,  1,  0,  0,  1,  0,  0,  1,  0,
        0, -1,  0,  0, -1,  0,  0, -1,  0,  0, -1,  0,
        0,  0,  1,  0,  0,  1,  0,  0,  1,  0,  0,  1,
        0,  0, -1,  0,  0, -1,  0,  0, -1,  0,  0, -1,
    ]);

    let u = uLength;
    let v = vLength;
    let uvs = new Float32Array([
        0, v, u, v, 0, 0, u, 0, 
        0, v, u, v, 0, 0, u, 0, 
        0, v, u, v, 0, 0, u, 0, 
        0, v, u, v, 0, 0, u, 0, 
        0, v, u, v, 0, 0, u, 0, 
        0, v, u, v, 0, 0, u, 0, 
    ]);

    let indices = new Uint32Array([     // triangle indices
         0,  2,  1,  2,  3,  1, // right
         4,  6,  5,  6,  7,  5, // left
         8, 10,  9, 10, 11,  9, // top
        12, 14, 13, 14, 15, 13, // bottom
        16, 18, 17, 18, 19, 17, // front
        20, 22, 21, 22, 23, 21, // back
    ]);

    let indices2 = new Uint32Array([    // wireframe indices
        8, 9, 9, 11, 11, 10, 10, 8,     // top
        14, 15, 15, 13, 13, 12, 12, 14, // bottom
        11, 13, 9, 15, 8, 14, 10, 12,   // side
    ])
    
    return {positions, colors, normals, uvs, indices, indices2};
}
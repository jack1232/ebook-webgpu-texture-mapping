export const drawMandelbrot = (ctx:CanvasRenderingContext2D, max_iteration:number) => {
    let r_set = { start: -2, end: 1 };
    let i_set = { start: -1, end: 1 };
    let colors = new Array(16).fill(0).map((_, i)=>i===0 ? '#000':`#${((1 << 24)*Math.random()|0).toString(16)}`);

    for(let i = 0; i < ctx.canvas.width; i++) {
        for(let j = 0; j < ctx.canvas.height; j++){
            let cv = {
                x: r_set.start + (i/ctx.canvas.width) * (r_set.end - r_set.start),
                y: i_set.start + (j/ctx.canvas.height) * (i_set.end - i_set.start)
            } 
            const [m, isMandelbrotSet] = mandelbrot(cv, max_iteration);
            ctx.fillStyle = colors[isMandelbrotSet ? 0:(m % colors.length - 1) + 1]
            ctx.fillRect(i, j, 1, 1)
        }
    }
}

const mandelbrot = (c:{x:number, y:number}, max_iteration:number):[number, Boolean] => {
    let z = {x:0, y:0}, n = 0, p, d;
    do {
        p = {
            x: Math.pow(z.x, 2) - Math.pow(z.y, 2),
            y: 2 * z.x * z.y
        };
        z = {
            x: p.x + c.x,
            y: p.y + c.y
        };
        d = Math.pow(z.x, 2) + Math.pow(z.y, 2);
        n++;
    } while (d <= 4 && n < max_iteration)
    return [n, d <= 4]
}

export const drawText  = (ctx:CanvasRenderingContext2D, t:number, 
starColor:string, starShape: number) => {    
    const drawStar = (x:number, y:number, r:number, n:number, inset:number) => {
        ctx.beginPath();
        ctx.translate(x, y);
        ctx.rotate(Math.PI/n  + t);
        ctx.moveTo(0, 0 - r);            
        for (var i = 0; i < n; i++) {
            ctx.rotate(Math.PI / n);
            ctx.lineTo(0, 0 - (r * inset));
            ctx.rotate(Math.PI / n);
            ctx.lineTo(0, 0 - r);
        }        
        ctx.closePath();
        ctx.fill();
    }
    
    let offset = 100;
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.save();
    ctx.fillStyle = '#aaa';
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.font = "100px serif";
    ctx.fillStyle = 'red';
    ctx.textAlign = 'center';
    ctx.fillText("WebGPU by Examples", ctx.canvas.width/2, 120 + offset);
    ctx.font = "60px serif";
    ctx.fillStyle = '#111';
    ctx.fillText("Learn and Explore Next-Generation", ctx.canvas.width/2, 250 + offset);
    ctx.fillText("Web Graphics and Compute API", ctx.canvas.width/2, 330 + offset);

    ctx.fillStyle = starColor;
    drawStar(ctx.canvas.width/2, 500 + offset, 30, starShape, 2.5);
    ctx.restore();
}
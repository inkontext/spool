var SpoolRenderer = {
    setColor: (ctx, color) => {
        ctx.fillStyle = color;
    },
    drawOval: (ctx, cx, cy, radius) => {
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, 360);
        ctx.stroke();
    },
    fillOval: (ctx, cx, cy, radius) => {
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, 360);
        ctx.fill();
    }
}
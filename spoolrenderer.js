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
    },
    renderRotatedSprite: (ctx, sprite, angle, cx, cy, bounds) => {
        ctx.save()

        ctx.translate(cx, cy);

        ctx.rotate(-angle)
        ctx.drawImage(sprite, bounds.x, bounds.y, bounds.width, bounds.height)

        ctx.restore()
    }
}
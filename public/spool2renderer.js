function SpoolRenderer(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.ctx;
}

/// SETTERS ///

SpoolRenderer.prototype.setColor = function (color) {
    this.ctx.fillStyle = color;
    this.ctx.strokeStyle = color;
};

SpoolRenderer.prototype.drawRect = function (pos, rad) {
    this.ctx.beginPath();
    this.ctx.rect(pos.x, pos.y, rad.x, rad.y);
    this.ctx.stroke();
};

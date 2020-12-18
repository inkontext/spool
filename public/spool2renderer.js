function Renderer2D(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.ctx;
}

/// SETTERS ///

Renderer2D.prototype.setColor = function (color) {
    this.ctx.fillStyle = color;
    this.ctx.strokeStyle = color;
};

/// LINES ///

Renderer2D.prototype.drawLine = function (a, b) {
    this.ctx.beginPath();
    this.ctx.moveTo(a.x, a.y);
    this.ctx.lineTo(b.x, b.y);
    this.ctx.stroke();
};

/// RECT ///

Renderer2D.prototype.rectPath = function (rect, dims) {
    if (dims === undefined) {
        this.ctx.beginPath();
        this.ctx.rect(rect.x, rect.y, rect.width, rect.height);
    } else {
        this.ctx.beginPath();
        this.ctx.rect(rect.x, rect.y, dims.x, dims.y);
    }
};

Renderer2D.prototype.drawRect = function (rect, dims) {
    this.rectPath(rect, dims);
    this.ctx.stroke();
};

Renderer2D.prototype.fillRect = function (rect, dims) {
    this.rectPath(rect, dims);
    this.ctx.fill();
};

/// CIRCLE ///

Renderer2D.prototype.circlePath = function (c, r, aStart = 0, aSpan = 360) {
    this.ctx.beginPath();
    this.ctx.arc(c.x, c.y, r, aStart, aSpan);
};

Renderer2D.prototype.drawCircle = function (c, r, aStart = 0, aSpan = 360) {
    this.circlePath(c, r, aStart, aSpan);
    this.ctx.stroke();
};

Renderer2D.prototype.fillCircle = function (c, r, aStart = 0, aSpan = 360) {
    this.circlePath(c, r, aStart, aSpan);
    this.ctx.fill();
};

/// POLYGON ///

Renderer2D.prototype.polygonPath = function (polygon) {
    this.ctx.beginPath();
    var startPoint = polygon.subTensor([0]);
    this.ctx.moveTo(startPoint.x, startPoint.y);

    let length = polygon.shape[0];
    for (var i = 1; i < length; i++) {
        var point = polygon.subTensor([i]);
        this.ctx.lineTo(point.x, point.y);
    }
    this.ctx.closePath();
};

Renderer2D.prototype.drawPolygon = function (p) {
    this.polygonPath(p);
    this.ctx.stroke();
};

Renderer2D.prototype.fillPolygon = function (p) {
    this.polygonPath(p);
    this.ctx.fill();
};

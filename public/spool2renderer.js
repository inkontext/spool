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

Renderer2D.prototype.polygonPath = function (polygon, close = true) {
    this.ctx.beginPath();
    var startPoint = polygon.subTensor([0]);
    this.ctx.moveTo(startPoint.x, startPoint.y);

    let length = polygon.shape[0];
    for (var i = 1; i < length; i++) {
        var point = polygon.subTensor([i]);
        this.ctx.lineTo(point.x, point.y);
    }
    if (close) {
        this.ctx.closePath();
    }
};

Renderer2D.prototype.drawPolygon = function (p, closed = true) {
    this.polygonPath(p, closed);
    this.ctx.stroke();
};

Renderer2D.prototype.fillPolygon = function (p) {
    this.polygonPath(p);
    this.ctx.fill();
};

/// TEXT ///

Renderer2D.prototype.drawText = function (text, p) {
    this.ctx.fillText(text, p.x, p.y);
};

/// GRAPH ///
Renderer2D.prototype.drawFunction = function (f, min, max, step, rect) {
    var pairs = [];

    var minValue = null;
    var maxValue = null;

    for (var i = min; i < max; i += step) {
        var y = f(i);
        if (!minValue || y < minValue) {
            minValue = y;
        }
        if (!maxValue || y > maxValue) {
            maxValue = y;
        }
        pairs.push([i, y]);
    }

    var values = [];
    var pairNumber = pairs.length;
    var stepWidth = rect.width / (pairNumber - 1);
    var valueRange = maxValue - minValue;
    for (var i = 0; i < pairNumber; i++) {
        var pair = pairs[i];
        var x = rect.x + stepWidth * i;
        var y = rect.y + (1 - (pair[1] - minValue) / valueRange) * rect.height;
        values.push(x);
        values.push(y);
    }

    if (SPMath.inRange(0, minValue, maxValue)) {
        var lineY = rect.y + (1 - (0 - minValue) / valueRange) * rect.height;
        this.drawLine(
            SPMath.point(rect.x, lineY),
            SPMath.point(rect.x + rect.width, lineY)
        );
    }

    this.drawPolygon(new Tensor([pairNumber, 2], values), false);

    this.drawText(
        maxValue.toFixed(2),
        SPMath.point(rect.x + rect.width, rect.y)
    );
    this.drawText(
        minValue.toFixed(2),
        SPMath.point(rect.x + rect.width, rect.y + rect.height)
    );
    this.drawText(
        min.toFixed(2),
        SPMath.point(rect.x, rect.y + rect.height + 20)
    );
    this.drawText(
        max.toFixed(2),
        SPMath.point(rect.x + rect.width, rect.y + rect.height + 20)
    );
};

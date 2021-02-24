//#region Canvas

function Canvas(id = null) {
    this.canvas = document.createElement("CANVAS");
    this.width = this.canvas.width;
    this.height = this.canvas.height;
    this.canvas.oncontextmenu = function (e) {
        e.preventDefault();
    };
    this.ctx = this.canvas.getContext("2d");

    if (id === null) {
        document.body.appendChild(this.canvas);
    } else {
        document.getElementById(id).appendChild(this.canvas);
    }
}

Canvas.prototype.fullScreen = function () {
    this.resize(window.innerWidth, window.innerHeight);
    return this;
};

Canvas.prototype.resize = function (width, height) {
    this.width = width;
    this.height = height;
    this.canvas.width = width;
    this.canvas.height = height;
    return this;
};

Canvas.prototype.renderBackground = function () {
    this.ctx.beginPath();
    this.ctx.rect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.fillStyle = "white";
    this.ctx.fill();
};

Canvas.prototype.clear = function () {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.renderBackground();
};

//#endregion Canvas

//#region MouseListener

function MouseListener(target) {
    this.activeTypes = ["mousedown", "mouseup"];
    this.pressedButtons = Array(3).fill(false);
    this.m = SPTensors.vector([0, 0]);
    this.dm = SPTensors.vector([0, 0]);
    this.target = target;
    this.onUpdate = () => {};
}

MouseListener.prototype.initListener = function () {
    this.target.onmousedown = (e) => {
        this.pressedButtons[e.button] = true;
        this.onUpdate(e);
    };

    this.target.onmouseup = (e) => {
        this.pressedButtons[e.button] = false;
        this.onUpdate(e);
    };

    this.target.onmousemove = (e) => {
        let px = this.m.x;
        let py = this.m.y;

        this.m.x = e.clientX;
        this.m.y = e.clientY;
        this.dm.x = this.m.x - px;
        this.dm.y = this.m.y - py;
        this.onUpdate(e);
    };
    return this;
};

//#endregion MouseListener

//#region Camera

function Camera(screenSize, pos = [0, 0], rot = 0, scale = [1, 1]) {
    this.screenSize = SPTensors.vector(screenSize);
    this.pos = SPTensors.vector(pos);
    this.rot = rot;
    this.scale = SPTensors.vector(scale);
}

Camera.prototype.transformPoint = function (point) {
    var sin = Math.sin(this.rot);
    var cos = Math.cos(this.rot);
    let { x, y } = point;
    var newX =
        this.scale.x * ((x - this.pos.x) * cos - (-y + this.pos.y) * sin) +
        this.screenSize.x / 2;
    var newY =
        this.scale.y * ((x - this.pos.x) * sin + (-y + this.pos.y) * cos) +
        this.screenSize.y / 2;
    return SPTensors.vector([newX, newY]);
};

Camera.prototype.inverseTransformPoint = function (point) {
    var sin = Math.sin(this.rot);
    var cos = Math.cos(this.rot);
    let { x, y } = point;
    var b =
        this.pos.y +
        sin * (x / this.scale.x - this.screenSize.x / 2) -
        cos * (y / this.scale.y - this.screenSize.y / 2);
    var a =
        this.pos.x +
        cos * (x / this.scale.x - this.screenSize.x / 2) +
        sin * (y / this.scale.y - this.screenSize.y / 2);

    return SPTensors.vector([a, b]);
};

Camera.prototype.transformPoints = function (...points) {
    var res = [];
    points.forEach((point) => {
        res.push(this.transformPoint(point));
    });
    return res;
};

Camera.prototype.transformPolygon = function (polygon) {
    var res = polygon.copy();
    let length = polygon.shape[0];

    for (var i = 0; i < length; i++) {
        var point = this.transformPoint(polygon.subTensor([i]));
        res.set(i * 2, point.x);
        res.set(i * 2 + 1, point.y);
    }
    return res;
};

Camera.prototype.transformScale = function (scale) {
    return SPTensors.mult(scale, this.scale);
};

//#endregion Camera

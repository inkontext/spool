////// CLIENT //////

var Z_SCALINGFACTOR_MAX = 10;
var Z_SCALINGFACTOR_MIN = 3;
var Z_SCALINGFACTOR = Z_SCALINGFACTOR_MAX;
var Z_SCALINGENABLED = true;

var colBoxes = {};

var client = null;

var Tile = (initObject) => {
    var self = Entity({
        ...initObject
    });

    var superSelf = {
        render: self.render
    }

    self.color = SpoolMath.randomColor(100, 255);
    self.darkColor = SpoolMath.divideColor(self.color, 2);

    self.update = (data) => {
        console.log(data);
        if (data.objects != []) {
            console.log(self.tx, self.ty);
        }
        Object.assign(self, data);
    }

    self.render = (ctx, camera) => {
        var r = self.hexRadius;
        var startAngle = 0;
        var n = 6;

        var points = []
        var pointsDown = []

        for (var i = 0; i < n; i++) {
            angle = startAngle + Math.PI * 2 / n * i;
            var point = camera.transformPoint(self.x - r * Math.cos(angle), self.y - r * Math.sin(angle));
            pointsDown.push(point);
            points.push({
                x: point.x,
                y: point.y - self.z * Z_SCALINGFACTOR
            })
        }


        ctx.fillStyle = '#' + self.darkColor;
        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y)
        ctx.lineTo(points[5].x, points[5].y)
        ctx.lineTo(points[4].x, points[4].y)
        ctx.lineTo(points[3].x, points[3].y)
        ctx.lineTo(pointsDown[3].x, client.gameArea.height) //pointsDown[3].y)
        // ctx.lineTo(pointsDown[2].x, pointsDown[2].y)
        // ctx.lineTo(pointsDown[1].x, pointsDown[1].y)
        ctx.lineTo(pointsDown[0].x, client.gameArea.height) //, pointsDown[0].y)
        ctx.closePath();
        ctx.fill();

        colPoint = camera.transformPoint(self.x, self.y);
        colBox = {
            x: colPoint.x,
            y: colPoint.y - self.z * Z_SCALINGFACTOR,
            radius: camera.transformDimension(self.hexRadius) * Math.sin(Math.PI / 3),
            tile: self
        }
        colBoxes[self.id] = colBox;



        ctx.fillStyle = self.color;
        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y)
        for (var i = 1; i < n; i++) {
            ctx.lineTo(points[i].x, points[i].y)
        }
        ctx.closePath();
        ctx.fill();

        self.objects.forEach(object => {
            var temp = client.handler.objectsById[object];
            if (temp) {
                temp.renderOnTile(ctx, camera, colBox.x, colBox.y);
            }
        })
    }

    return self;
}

var Player = (initObject) => {
    var self = RectangleEntity({
        ...initObject
    })

    self.render = () => {};

    self.renderOnTile = (ctx, camera, tilex, tiley) => {
        SpoolRenderer.setColor(ctx, self.color);
        console.log(tilex, tiley)
        SpoolRenderer.fillOval(ctx, tilex, tiley, 30);
    }

    return self;
}

var OBJECTS = {
    'TILE': {
        const: Tile
    },
    'PLAYER': {
        const: Player
    }
}

client = Client({
    keyToConstructor: OBJECTS
});

client.preHandler = () => {
    if (Z_SCALINGENABLED) {
        Z_SCALINGFACTOR = SpoolMath.lerp(Z_SCALINGFACTOR, Z_SCALINGFACTOR_MAX, 0.5)
    } else {
        Z_SCALINGFACTOR = SpoolMath.lerp(Z_SCALINGFACTOR, Z_SCALINGFACTOR_MIN, 0.5)
    }
}



client.camera.scaleY = 0.8

client.socketInit()

var keyListener = KeyboardListener(client.socket);
keyListener.initListener();
keyListener.onKeyDown = (event) => {
    if (event.keyCode == 70) {
        Z_SCALINGENABLED = !Z_SCALINGENABLED;
    }
}

var mouseListener = MouseListener(client);
mouseListener.initListener();
client.onMouseEvent = (event) => {
    var res = null;
    Object.keys(colBoxes).forEach(key => {
        var box = colBoxes[key];
        if (SpoolMath.distance(event.x, event.y, box.x, box.y) <= box.radius) {
            res = box.tile;
        }
    })
    if (res) {
        res.color = 'red';
        client.emit("MOVE_TO", {
            tx: res.tx,
            ty: res.ty
        });
    }


}

client.startGameLoop()


////// CAMERA //////

client.camera.onUpdate = (self) => {
    if (client.clientObject) {
        self.followObject = client.clientObject;
    }
}
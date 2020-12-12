var SpoolRenderer = {
    //// CTX SETTING ////
    ctx: null,
    camera: null,

    setColor: (color) => {
        SpoolRenderer.ctx.fillStyle = color;
        SpoolRenderer.ctx.strokeStyle = color;
    },

    setFont: (fontFace, fontSize) => {
        SpoolRenderer.ctx.font = `${fontSize}px ${fontFace}`;
    },

    //// OVALS ////

    drawInscribedOval: (rect) => {
        SpoolRenderer.ctx.beginPath();
        SpoolRenderer.ctx.ellipse(
            rect.cx,
            rect.cy,
            rect.width / 2,
            rect.height / 2,
            0,
            0,
            360
        );
        SpoolRenderer.ctx.stroke();
    },

    fillInscribedOval: (rect) => {
        SpoolRenderer.ctx.beginPath();
        SpoolRenderer.ctx.ellipse(
            rect.cx,
            rect.cy,
            rect.width / 2,
            rect.height / 2,
            0,
            0,
            360
        );
        SpoolRenderer.ctx.fill();
    },

    tDrawPoint: (x, y, rad) => {
        var a = SpoolRenderer.camera.transformPoint(x, y);
        SpoolRenderer.fillOval(a.x, a.y, rad);
    },

    drawLine: (x1, y1, x2, y2) => {
        SpoolRenderer.ctx.beginPath();
        SpoolRenderer.ctx.moveTo(x1, y1);
        SpoolRenderer.ctx.lineTo(x2, y2);
        SpoolRenderer.ctx.stroke();
    },

    tDrawLine: (x1, y1, x2, y2) => {
        var a = SpoolRenderer.camera.transformPoint(x1, y1);
        var b = SpoolRenderer.camera.transformPoint(x2, y2);

        SpoolRenderer.ctx.beginPath();
        SpoolRenderer.ctx.moveTo(a.x, a.y);
        SpoolRenderer.ctx.lineTo(b.x, b.y);
        SpoolRenderer.ctx.stroke();
    },

    fillInscribedOvalPercentFull: (rect, p) => {
        SpoolRenderer.ctx.beginPath();
        if (p > 0.5) {
            var temp = p - 0.5;
            var angle = Math.asin(temp * 2);
            SpoolRenderer.ctx.ellipse(
                rect.cx,
                rect.cy,
                rect.width / 2,
                rect.height / 2,
                0,
                -angle,
                Math.PI + angle
            );
        } else {
            var angle = Math.asin((0.5 - p) * 2);
            SpoolRenderer.ctx.ellipse(
                rect.cx,
                rect.cy,
                rect.width / 2,
                rect.height / 2,
                0,
                angle,
                Math.PI - angle
            );
        }
        SpoolRenderer.ctx.fill();
    },

    drawOval: (cx, cy, radius) => {
        SpoolRenderer.ctx.beginPath();
        SpoolRenderer.ctx.arc(cx, cy, radius, 0, 360);
        SpoolRenderer.ctx.stroke();
    },

    fillOval: (cx, cy, radius) => {
        SpoolRenderer.ctx.beginPath();
        SpoolRenderer.ctx.arc(cx, cy, radius, 0, 360);
        SpoolRenderer.ctx.fill();
    },

    linePolygon: (points) => {
        SpoolRenderer.ctx.beginPath();
        SpoolRenderer.ctx.moveTo(points[0][0], points[0][1]);
        for (var i = 1; i < points.length; i++) {
            SpoolRenderer.ctx.lineTo(points[i][0], points[i][1]);
        }
        SpoolRenderer.ctx.closePath();
    },

    fillPolygon: (points) => {
        SpoolRenderer.linePolygon(points);
        SpoolRenderer.ctx.fill();
    },

    //// SPRITES ////

    renderRotatedSprite: (sprite, angle, cx, cy, bounds) => {
        SpoolRenderer.ctx.save();

        SpoolRenderer.ctx.translate(cx, cy);

        SpoolRenderer.ctx.rotate(-angle);
        SpoolRenderer.ctx.drawImage(
            sprite,
            bounds.x,
            bounds.y,
            bounds.width,
            bounds.height
        );

        SpoolRenderer.ctx.restore();
    },

    //// RECT ////

    drawRect: (x, y, width, height) => {
        SpoolRenderer.ctx.beginPath();
        SpoolRenderer.ctx.rect(x, y, width, height);
        SpoolRenderer.ctx.stroke();
    },

    tDrawRect: (x, y, width, height) => {
        const bounds = SpoolRenderer.camera.transformBounds(
            x,
            y,
            width,
            height
        );
        SpoolRenderer.drawRect(
            bounds.x,
            bounds.y - bounds.height,
            bounds.width,
            bounds.height
        );
    },

    fillRect: (x, y, width, height) => {
        SpoolRenderer.ctx.fillRect(x, y, width, height);
    },

    fillSplRect: (rect) => {
        SpoolRenderer.ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
    },

    drawSplRect: (rect) => {
        SpoolRenderer.ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
    },

    fillRoundRect(
        ctx,
        x,
        y,
        width,
        height,
        radius = 0,
        fill = true,
        stroke = false
    ) {
        if (typeof radius === "undefined") {
            radius = 5;
        }
        if (typeof radius === "number") {
            radius = {
                tl: radius,
                tr: radius,
                br: radius,
                bl: radius,
            };
        } else {
            var defaultRadius = {
                tl: 0,
                tr: 0,
                br: 0,
                bl: 0,
            };
            for (var side in defaultRadius) {
                radius[side] = radius[side] || defaultRadius[side];
            }
        }
        ctx.beginPath();
        ctx.moveTo(x + radius.tl, y);
        ctx.lineTo(x + width - radius.tr, y);
        ctx.quadraticCurveTo(x + width, y, x + width, y + radius.tr);
        ctx.lineTo(x + width, y + height - radius.br);
        ctx.quadraticCurveTo(
            x + width,
            y + height,
            x + width - radius.br,
            y + height
        );
        ctx.lineTo(x + radius.bl, y + height);
        ctx.quadraticCurveTo(x, y + height, x, y + height - radius.bl);
        ctx.lineTo(x, y + radius.tl);
        ctx.quadraticCurveTo(x, y, x + radius.tl, y);
        ctx.closePath();

        if (fill) {
            ctx.fill();
        }
        if (stroke) {
            ctx.stroke();
        }
    },

    //// TEXT ////

    multiLineText: (
        text,
        box,
        maxWidth,
        fontOffsetCoef = 0.33,
        strokeWidth = null
    ) => {
        var hardLines = text.split("\n");
        var lines = [];

        hardLines.forEach((singleHardLine) => {
            var words = singleHardLine.split(" ");
            var line = "";

            SpoolRenderer.ctx.textAlign = "center";

            words.forEach((word, index) => {
                var tempWidth = SpoolRenderer.ctx.measureText(line + word)
                    .width;
                if (tempWidth >= maxWidth) {
                    lines.push(line.trim());
                    line = word;
                } else {
                    line += " " + word;
                }
            });

            if (line) {
                lines.push(line.trim());
            }
        });

        var lineHeight = parseInt(SpoolRenderer.ctx.font) + 3;

        lines.forEach((line, index) => {
            var tx = box.x + box.width / 2;
            var ty =
                box.y +
                box.height / 2 -
                ((lines.length - 1) / 2) * lineHeight +
                index * lineHeight +
                lineHeight * fontOffsetCoef;

            if (strokeWidth) {
                SpoolRenderer.ctx.lineWidth = strokeWidth;
                SpoolRenderer.ctx.strokeText(line, tx, ty);
            }
            SpoolRenderer.ctx.fillText(line, tx, ty);
        });
    },

    simpleText: (text, x, y, stroke = null) => {
        if (stroke) {
            SpoolRenderer.ctx.lineWidth = stroke;
            SpoolRenderer.ctx.strokeText(text, x, y);
        }
        SpoolRenderer.ctx.fillText(text, x, y);
    },

    tSimpleText: (text, x, y, stroke = null) => {
        var point = SpoolRenderer.camera.transformPoint(x, y);
        if (stroke) {
            SpoolRenderer.ctx.lineWidth = stroke;
            SpoolRenderer.ctx.strokeText(text, point.x, point.y);
        }
        SpoolRenderer.ctx.fillText(text, point.x, point.y);
    },
};

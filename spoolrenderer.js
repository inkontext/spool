var SpoolRenderer = {
    setColor: (ctx, color) => {
        ctx.fillStyle = color;
    },

    setFont: (ctx, fontFace, fontSize) => {
        ctx.font = `${fontSize}px ${fontFace}`;
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

    drawRect: (ctx, x, y, width, height) => {
        ctx.drawRect(x, y, width, height);
    },

    fillRect: (ctx, x, y, width, height) => {
        ctx.fillRect(x, y, width, height);
    },

    fillSplRect: (ctx, rect) => {
        ctx.fillRect(rect.x, rect.y, rect.width, rect.height)
    },

    multiLineText: (ctx, text, box, maxWidth) => {
        var words = text.split(' ');
        var line = '';
        var lines = [];

        ctx.textAlign = 'center';

        words.forEach((word, index) => {
            var tempWidth = ctx.measureText(line + word).width;
            if (tempWidth >= maxWidth) {
                lines.push(line.trim());
                line = word;
            } else {
                line += ' ' + word;
            }
        })

        if (line) {
            lines.push(line.trim());
        }

        var lineHeight = parseInt(ctx.font) + 3;

        ctx.strokeRect(box.x, box.y, box.width, box.height);

        lines.forEach((line, index) => {
            ctx.fillText(
                line,
                box.x + box.width / 2,
                box.y + box.height / 2 - (lines.length - 1) / 2 * lineHeight + index * lineHeight + lineHeight / 3)
        })
    }
}
const FileReader = {
    readImage: (fileName, callback, pixelSize = 4) => {


        var image = new Image();
        image.onload = () => {
            var canvas = document.createElement('canvas');
            canvas.width = image.width;
            canvas.height = image.height;

            var ctx = canvas.getContext('2d');
            ctx.drawImage(image, 0, 0, image.width, image.height);
            var data = ctx.getImageData(0, 0, image.width, image.height);

            callback({
                data: data.data,
                width: data.width,
                height: data.height,
                pixelSize: pixelSize,
            })
        }

        image.src = fileName;
    }
}
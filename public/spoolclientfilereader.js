const FileReader = {
    readImage: (fileName, callback) => {

        var image = new Image();
        image.onLoad = () => {

            var canvas = document.createElement('canvas');
            canvas.width = image.width;
            canvas.height = image.height;

            var ctx = canvas.getContext('2d').drawImage(image, 0, 0, image.width, image.height);

            var pixelData = ctx.getImageData(0, 0, image.width, image.height);

            console.log(pixelData);
        }
        image.src = fileName;
    }
}
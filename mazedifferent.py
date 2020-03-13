from PIL import Image
im = Image.open('image.png')


pixels = im.load()


newpixels = []
for y in range(0, im.height):
    if(y % 5 == 0 or y % 5 == 1):
        newline = []
        for x in range(0, im.width):
            if(x % 5 == 0 or x % 5 == 1):
                newline.append(pixels[x, y])
        newpixels.append(newline)   

height = len(newpixels)
width = len(newpixels[0])

print(newpixels)

newimg = Image.new('RGBA', (width, height), (255, 0, 0, 0))
pixels = newimg.load();
    
for y in range(0, width):
    for x in range(0, height):
        pixels[x, y] = newpixels[x][y]

newimg.save('newimage.png', 'PNG')

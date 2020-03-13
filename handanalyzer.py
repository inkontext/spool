import json
from PIL import Image
im = Image.open('player-hand.png')


pixels = im.load()


newpixels = []

columns = 8
rows = 9

tile_width = im.width // columns
tile_height = im.height // rows


hands = []

lefthand = []
righthand = []

for y in range(0, rows):
    left_row = []
    right_row = []
    for x in range(0, columns):
        left_row.append([0, 0, 0])
        right_row.append([0, 0, 0])
    lefthand.append(left_row)
    righthand.append(right_row)

hands.append(lefthand)
hands.append(righthand)


def equal(a, b):
    if len(a) != len(b):
        return False
    else:
        for i in range(len(a)):
            if(a[i] != b[i]):
                return False
        return True


for y in range(0, im.height):
    for x in range(0, im.width):
        bodypart_index = None

        if(pixels[x, y] == (0, 255, 0, 255)):
            bodypart_index = 1
        elif(pixels[x, y] == (255, 0, 0, 255)):
            bodypart_index = 0

        if(bodypart_index != None):
            xi = x // tile_width
            yi = y // tile_height

            currValue = hands[bodypart_index][yi][xi]
            hands[bodypart_index][yi][xi][0] = (currValue[0] *
                                                currValue[2] + (x - tile_width * xi)) / (currValue[2] + 1)
            hands[bodypart_index][yi][xi][1] = (currValue[1] *
                                                currValue[2] + (y - tile_height * yi)) / (currValue[2] + 1)
            hands[bodypart_index][yi][xi][2] += 1

body = {}
body['lefthand'] = hands[0]
body['righthand'] = hands[1]

with open('body.json', 'w') as f:
    json.dump(body, f)

import pygame
import lorem
import random
from PIL import Image
import numpy as np
import colorsys
import json
import os

def event_handle():
    for event in pygame.event.get():
        if event.type == pygame.QUIT:
            quit()


def char_is_last_or_pre_last(text, char):
    if len(text) > 1:
        return text[-1] == char or text[-2] == char


def remove_last_or_pre_last_char(text, char):
    if text[-1] == char:
        return text[:-1]
    if len(text) > 1:
        if text[-2] == char:
            return text[:-2] + text[-1]


def draw_image(surface, img, coors, size, centered=False, angle=0):
    # Resizing and converting to alpha, so that padded area is transparent
    img = pygame.transform.scale(img, size).convert_alpha()
    # Getting new coors if centered
    if centered:
        new_coors = [0, 0]
        new_coors[0] = int(coors[0] - img.get_width()/2)
        new_coors[1] = int(coors[1] - img.get_height()/2)
        coors = new_coors
    # Rotating
    img = pygame.transform.rotate(img, angle)
    # Bliting lol
    surface.blit(img, coors)


def font_of_max_size(size, text, font_name, bold=False, italic=False, underline=False):
    # Works only for one row
    font_ascent = 1
    # Enlarge the font until it doesn't fit anymore, then return the previous one
    while True:
        font = pygame.font.Font(font_name, font_ascent)
        font.set_bold(bold)
        font.set_underline(underline)
        font.set_italic(italic)
        if font.size(text)[0] > size[0] or font.size(text)[1] > size[1]:
            font = pygame.font.Font(font_name, font_ascent-1)
            font.set_bold(bold)
            font.set_underline(underline)
            font.set_italic(italic)
            return font
        else:
            font_ascent += 1


def uncentered_coordinates(coordinates, text, font):
    return (int(coordinates[0] - font.size(text)[0]/2), int(coordinates[1] - font.size(text)[1]/2))


def renderText(surface, text, coors, font, angle=0, color=(0,0,0), centered=False, antialias=False, background=None):
    if centered:
        # Move coors
        coors = uncentered_coordinates(coors, text, font)
    # Create surface with text
    text_surface = font.render(text, antialias, color, background)
    # Rotate surface
    text_surface = pygame.transform.rotate(text_surface, angle)
    # Blit??
    surface.blit(text_surface, coors)


def render_text_into_box(surface, text, optimal_font_ascent, coors, size, font_name, color, rows_spacing, block_align=False, background=None, centered = False, center_align = False):
    if centered:
        coors = [coors[0] - size[0]/2, coors[1] - size[1]/2]
    is_bold = False
    words = text.split(" ")
    sections = [[] for i in range(text.count("\n") + 1)]
    section_index = 0
    word = ""
    is_bold = False
    # Split text to words and words to sections and decide if they are bold
    for char in text:
        # Bold font boundary and also word splitter
        if char == "*":
            if word:
                # Append current word to its section
                sections[section_index].append([word, is_bold])
            is_bold = not is_bold
            word = ""
        # Section ending
        elif char == "\n":
            if word:
                # Append current word to its section
                sections[section_index].append([word, is_bold])
                word = ""
            # Move to another section
            section_index += 1
        # Word ending
        elif char == " ":
            if word:
                # Append current word to its section
                sections[section_index].append([word, is_bold])
                word = ""
        # If none special char appears, just add it to the current word
        else:
            word += char
    # If some word is left after the loop, append it
    if word:
        sections[section_index].append([word, is_bold])

    index = 0
    font_ascent = optimal_font_ascent
    # Anti enlarge the font until it doesn't fit anymore, then return the previous one
    while True:
        # Initialization of fonts
        classic_font = pygame.font.Font(font_name, font_ascent)
        bold_font = pygame.font.Font(font_name, font_ascent)
        bold_font.set_bold(True)
        row_height = bold_font.size("QWERTZUIOPASDFGHJKLYXCVBNM123456789'")[1]
        word_is_too_big = False
        rows = []
        for section in sections:
            row = []
            word_index = 0
            for word in section:
                # Choose font depending on the boldness of word
                font = bold_font if word[1] else classic_font
                # Width of current word
                word_width = font.size(word[0])[0]
                row_width = 0
                # Sum of widths of words in current row
                for i in range(word_index-len(row),word_index):
                    # Choose font
                    font = bold_font if section[i][1] else classic_font
                    # Width of current word in row
                    row_width += font.size(section[i][0] + " ")[0]
                if row_width > size[0]:
                    word_is_too_big = True
                row_width += word_width
                # If row with the current word is wider then the block, add it to new row
                if row_width > size[0]:
                    rows.append([row, row_width - font.size(word[0])[0]])
                    row = [word]
                # Else add it to the current row
                else:
                    row.append(word)
                word_index += 1
            # If some row is left after the loop, append it
            if row:
                row_width = 0
                for word in row:
                    # Choose font
                    font = bold_font if word[1] else classic_font
                    # Width of current word in row
                    row_width += font.size(word[0] + " ")[0]
                if row_width > size[0]:
                    word_is_too_big = True
                rows.append([row, None])
        # Total height of the paragraph
        total_height = len(rows) * row_height + (len(rows)-1) * rows_spacing
        # If paragraph is taller then block, end loop and return previous font ascent
        if total_height <= size[1] and not word_is_too_big:
            break
        # Else try smaller font
        else:
            # Save current layout of rows for potential future use
            font_ascent -= 1
    # Set x any y to block coors
    x = coors[0]
    y = coors[1] + (size[1] - total_height) / 2
    # Initialize fonts
    classic_font = pygame.font.Font(font_name, font_ascent)
    bold_font = pygame.font.Font(font_name, font_ascent)
    bold_font.set_bold(True)
    row_height = bold_font.size("QWERTZUIOPASDFGHJKLYXCVBNM123456789")[1]
    # Draw background - probably will be deleted
    if background:
        pygame.draw.rect(surface, background, [coors[0], coors[1], size[0], size[1]])

    for row in rows:
        if block_align and len(row[0]) != 1 and row[1]:
            block_align_spacing = (size[0] - row[1]) / (len(row[0])-1)
        elif center_align:
            rowt = ""
            for word in row[0]:
                rowt += word[0] + " "
            rowt = rowt[:-1]
            row_width = classic_font.size(rowt)[0]
            #row_width = classic_font.size(" ")[0] * (len(row)-1)
            #for word in row[0]:
            #    font = bold_font if word[1] else classic_font
            #    row_width += font.size(word[0])[0]
            x += (size[0] - row_width) / 2
            print(row, row_width)
            #pygame.draw.rect(surface, (0, 255, 255), [coors[0], y, (size[0] - row_width) / 2, row_height])
        for word in row[0]:
            # Choose font
            font = bold_font if word[1] else classic_font
            # Render word
            renderText(surface, word[0], (x, y), font, color=color)
            # Move x coor by the size of word
            if block_align and len(row[0]) != 1 and row[1]:
                x += font.size(word[0])[0] + block_align_spacing
            else:
                x += font.size(word[0])[0] + classic_font.size(" ")[0]
        # Move y coor by the size of row_height and rows_spacing
        y += row_height + rows_spacing
        # Reset x coor
        x = coors[0]
    pygame.display.update()


def export_surface_area(surface, coors, size, file_name):
    new_surface = surface.subsurface(pygame.Rect(coors[0], coors[1], size[0], size[1]))
    #new_surface.convert_alpha()
    #new_surface.set_alpha(0)
    pygame.image.save(new_surface, file_name)


def get_subsurface(surface, coors, size):
    return surface.subsurface(pygame.Rect(coors[0], coors[1], size[0], size[1]))


def render_stack_of_cards(json, items_tiles, multiplier):
    surface = pygame.Surface([1500*multiplier, 1000*multiplier], pygame.SRCALPHA, 32)
    surface = surface.convert_alpha()

    weapon_card_border_img = pygame.image.load("card_border.png")
    spell_card_border_img = pygame.image.load("card_borders/greyscale/border_10.png")
    trinket_card_border_img = pygame.image.load("dark_green_border.png")
    special_card_border_img = pygame.image.load("card_borders/classic/border_265.png")
    top_background_img = pygame.image.load("bg_vignetta.png")
    weapon_bottom_background_img = pygame.image.load("card_bottom_bg.png")
    spell_bottom_background_img = pygame.image.load("card_bottom_bgs/greyscale/bg_13.png")
    #trinket_bottom_background_img = pygame.image.load("card_bottom_bgs/classic/bg_210.png")
    trinket_bottom_background_img = pygame.image.load("dark_purple_bg.png")
    #special_bottom_background_img = pygame.image.load("card_bottom_bgs/classic/bg_265.png")
    special_bottom_background_img = pygame.image.load("card_bottom_bgs/classic/bg_0.png")
    title_img = pygame.image.load("card_title.png")
    background_size = [i*multiplier for i in (90, 90)]
    coors = (0, 0)
    font_color = (40, 34, 8)
    total_card_size = [i*multiplier for i in (102, 190)]
    card_base_coors = [i*multiplier for i in (6, 5)]
    card_base_size = [i*multiplier for i in (90, 185)]
    top_hexagon_middle_coors = [i*multiplier for i in (51, 55)]
    #title_middle_coors = [i*multiplier for i in (51, 95)]
    title_middle_coors = [i*multiplier for i in (51, 98)]
    title_size = [i*multiplier for i in (74, 15)]
    """crystal_font = pygame.font.SysFont("Perfect DOS VGA 437", 25)
    title_font_name = "Perfect DOS VGA 437"
    description_font_name = "04B_03_" """
    
    crystal_font = pygame.font.Font("./../fonts/dpcomic.ttf", 30)
    
    title_font_name = "./../fonts/dpcomic.ttf"
    description_font_name = "./../fonts/dpcomic.ttf"
    #description_font_name = "Arial"
    description_optimal_font_ascent = 23
    bottom_hexagon_middle_coors = [i*multiplier for i in (51, 139)]
    bottom_size = [i*multiplier for i in (66, 41)]
    #bottom_size = [i*multiplier for i in (56, 41)]
    crystal_size = [i*multiplier for i in (24, 25)]
    left_crystal_coors = [i*multiplier for i in (0, 43)]
    middle_left_crystal_coors = (left_crystal_coors[0] + crystal_size[0]/2, left_crystal_coors[1] + crystal_size[1]/2)
    top_crystal_coors = [i*multiplier for i in (39, 0)]
    middle_top_crystal_coors = (top_crystal_coors[0] + crystal_size[0]/2, top_crystal_coors[1] + crystal_size[1]/2)
    right_crystal_coors = [i*multiplier for i in (78, 43)]
    middle_right_crystal_coors = (right_crystal_coors[0] + crystal_size[0]/2, right_crystal_coors[1] + crystal_size[1]/2)
    item_tile_size = (32, 32)
    rendered_item_size = [i*multiplier for i in (32, 32)]
    items_tiles_width = 5
    left_crystal_img = pygame.image.load("crystals/crystals/classic/crystal75.png")
    top_crystal_img = pygame.image.load("crystals/crystals/classic/crystal215.png")
    right_crystal_img = pygame.image.load("crystals/crystals/classic/crystal335.png")
    crystal_number_offset = (1, 0)
    for card in json["cards"]:

	
        x, y = ((card["cardTileIndex"] % items_tiles_width) * total_card_size[0], (card["cardTileIndex"] // items_tiles_width) * total_card_size[1])

        draw_image(surface, top_background_img, (top_hexagon_middle_coors[0] + x, top_hexagon_middle_coors[1] + y), background_size, centered = True)

        if card["type"] == "weapon":
            draw_image(surface, weapon_bottom_background_img, (card_base_coors[0] + x, card_base_coors[1] + y), card_base_size)
            draw_image(surface, weapon_card_border_img, (card_base_coors[0] + x, card_base_coors[1] + y), card_base_size)
        elif card["type"] == "spell":
            draw_image(surface, spell_bottom_background_img, (card_base_coors[0] + x, card_base_coors[1] + y), card_base_size)
            draw_image(surface, spell_card_border_img, (card_base_coors[0] + x, card_base_coors[1] + y), card_base_size)
        elif card["type"] == "trinket":
            draw_image(surface, trinket_bottom_background_img, (card_base_coors[0] + x, card_base_coors[1] + y), card_base_size)
            draw_image(surface, trinket_card_border_img, (card_base_coors[0] + x, card_base_coors[1] + y), card_base_size)
        elif card["type"] == "special":
            draw_image(surface, special_bottom_background_img, (card_base_coors[0] + x, card_base_coors[1] + y), card_base_size)
            draw_image(surface, special_card_border_img, (card_base_coors[0] + x, card_base_coors[1] + y), card_base_size)

        draw_image(surface, title_img, (card_base_coors[0] + x, card_base_coors[1] + y), card_base_size)

        img_x = (card["textureTileIndex"] % items_tiles_width) * item_tile_size[0]
        img_y = (card["textureTileIndex"] // items_tiles_width) * item_tile_size[1]
        img = get_subsurface(items_tiles, (img_x, img_y), item_tile_size)
        draw_image(surface, img, (top_hexagon_middle_coors[0] + x, top_hexagon_middle_coors[1] + y), rendered_item_size, centered=True)


        if card["type"] == "weapon":
            draw_image(surface, left_crystal_img, (left_crystal_coors[0]+1 + x, left_crystal_coors[1] + y), crystal_size)
            font_size = crystal_font.size(str(card["dmg"]))
            font_x = middle_left_crystal_coors[0] + x - font_size[0]/2 + crystal_number_offset[0]
            font_y = middle_left_crystal_coors[1] + y - font_size[1]/2 + crystal_number_offset[1]
            renderText(surface, str(card["dmg"]), (font_x+1, font_y), crystal_font, centered=False, color = font_color)
            renderText(surface, str(card["dmg"]), (font_x-1, font_y), crystal_font, centered=False, color = font_color)
            renderText(surface, str(card["dmg"]), (font_x, font_y+1), crystal_font, centered=False, color = font_color)
            renderText(surface, str(card["dmg"]), (font_x, font_y-1), crystal_font, centered=False, color = font_color)
            renderText(surface, str(card["dmg"]), (font_x, font_y), crystal_font, centered=False, color = (255, 255, 255))


        draw_image(surface, top_crystal_img, (top_crystal_coors[0] + x, top_crystal_coors[1] + y), crystal_size)
        font_size = crystal_font.size(str(card["cost"]))
        font_x = middle_top_crystal_coors[0] + x - font_size[0]/2 + crystal_number_offset[0]
        font_y = middle_top_crystal_coors[1] + y - font_size[1]/2 + crystal_number_offset[1]
        renderText(surface, str(card["cost"]), (font_x+1, font_y), crystal_font, centered=False, color = font_color)
        renderText(surface, str(card["cost"]), (font_x-1, font_y), crystal_font, centered=False, color = font_color)
        renderText(surface, str(card["cost"]), (font_x, font_y+1), crystal_font, centered=False, color = font_color)
        renderText(surface, str(card["cost"]), (font_x, font_y-1), crystal_font, centered=False, color = font_color)
        renderText(surface, str(card["cost"]), (font_x, font_y), crystal_font, centered=False, color = (255, 255, 255))
        #renderText(surface, str(card["cost"]), (middle_top_crystal_coors[0] + x, middle_top_crystal_coors[1] + y), crystal_font, centered=True, color = (255, 255, 255))


        draw_image(surface, right_crystal_img, (right_crystal_coors[0] + x, right_crystal_coors[1] + y), crystal_size)
        font_size = crystal_font.size(str(card["range"]))
        font_x = middle_right_crystal_coors[0] + x - font_size[0]/2 + crystal_number_offset[0]
        font_y = middle_right_crystal_coors[1] + y - font_size[1]/2 + crystal_number_offset[1]
        renderText(surface, str(card["range"]), (font_x+1, font_y), crystal_font, centered=False, color = font_color)
        renderText(surface, str(card["range"]), (font_x-1, font_y), crystal_font, centered=False, color = font_color)
        renderText(surface, str(card["range"]), (font_x, font_y+1), crystal_font, centered=False, color = font_color)
        renderText(surface, str(card["range"]), (font_x, font_y-1), crystal_font, centered=False, color = font_color)
        renderText(surface, str(card["range"]), (font_x, font_y), crystal_font, centered=False, color = (255, 255, 255))

        title_font = font_of_max_size(title_size, card["name"], title_font_name)
        renderText(surface, str(card["name"]), (title_middle_coors[0] + x, title_middle_coors[1] + y), title_font, centered=True, color=font_color)
        render_text_into_box(surface, card["description"], description_optimal_font_ascent, (bottom_hexagon_middle_coors[0] + x, bottom_hexagon_middle_coors[1] + y), bottom_size, description_font_name, font_color, 0, centered = True, center_align = True)

        #pygame.draw.rect(surface, (255, 0, 0), [bottom_hexagon_middle_coors[0], bottom_hexagon_middle_coors[1], 1, 1])


        export_surface_area(surface, coors, total_card_size, "cards/" +  card["cardID"] + ".png")

    export_surface_area(surface, (0, 0), (204*5, 380*3), "./../textures/full_stack.png")




rgb_to_hsv = np.vectorize(colorsys.rgb_to_hsv)
hsv_to_rgb = np.vectorize(colorsys.hsv_to_rgb)

def shift_hue(arr, hout):
    r, g, b, a = np.rollaxis(arr, axis=-1)
    h, s, v = rgb_to_hsv(r, g, b)
    h = hout
    r, g, b = hsv_to_rgb(h, s, v)
    arr = np.dstack((r, g, b, a))
    return arr

def colorize(image, hue):

    #Colorize PIL image `original` with the given
    #`hue` (hue within 0-360); returns another PIL image.

    img = image.convert('RGBA')
    arr = np.array(np.asarray(img).astype('float'))
    new_img = Image.fromarray(shift_hue(arr, hue/360.).astype('uint8'), 'RGBA')

    return new_img


# Initializatin of pygame, font and surface
pygame.init()
pygame.font.init()
display = pygame.display.set_mode((1000, 1000))



with open('./../cards.json', 'r') as myfile:
    data=myfile.read()

obj = json.loads(data)

items_tiles = pygame.image.load("./../items-tiles.png")


size_multiplier = 2

render_stack_of_cards(obj, items_tiles, size_multiplier)

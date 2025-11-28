from PIL import Image, ImageDraw, ImageFont
import os

# 创建简单的图标（如果没有 PIL，用纯色代替）
def create_simple_icon(size, output_path):
    # 创建一个蓝色背景的图标，带白色 M 字母
    img = Image.new('RGB', (size, size), color='#007bff')
    draw = ImageDraw.Draw(img)
    
    # 绘制白色 M 字母
    try:
        # 尝试使用系统字体
        font_size = int(size * 0.6)
        font = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", font_size)
    except:
        # 如果没有字体，使用默认
        font = ImageFont.load_default()
    
    text = "M"
    # 获取文字边界框
    bbox = draw.textbbox((0, 0), text, font=font)
    text_width = bbox[2] - bbox[0]
    text_height = bbox[3] - bbox[1]
    
    # 居中文字
    x = (size - text_width) / 2
    y = (size - text_height) / 2 - bbox[1]
    
    draw.text((x, y), text, fill='white', font=font)
    img.save(output_path)
    print(f"Created {output_path}")

# 创建三种尺寸的图标
create_simple_icon(16, 'icon-16.png')
create_simple_icon(48, 'icon-48.png')
create_simple_icon(128, 'icon-128.png')

print("All icons created successfully!")
